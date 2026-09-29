package ofrep

import (
	"bytes"
	"container/list"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
)

// CohortConfig enables organization cohorts only for explicitly selected authenticated stacks.
// Configure before serving requests. An empty allowlist disables lookups but still scrubs
// reserved attributes.
type CohortConfig struct {
	URL               string
	TokenFile         string
	AllowedNamespaces []string
	Timeout           time.Duration
	CacheTTL          time.Duration
	MaxSnapshotAge    time.Duration
	MaxEntries        int
	MaxConcurrent     int
}

type cohortSnapshot struct {
	Cohorts  []string `json:"cohorts"`
	Snapshot *struct {
		Version     string    `json:"version"`
		RefreshedAt time.Time `json:"refreshedAt"`
	} `json:"snapshot"`
	orgID string
}

type cohortCacheEntry struct {
	namespace string
	value     cohortSnapshot
	expires   time.Time
}

type cohortResolver struct {
	config   CohortConfig
	baseURL  *url.URL
	client   *http.Client
	allowed  map[string]bool
	mu       sync.Mutex
	cache    map[string]*list.Element
	lru      *list.List
	inflight map[string]chan struct{}
	slots    chan struct{}
	now      func() time.Time
	outcomes *prometheus.CounterVec
	duration prometheus.Histogram
	age      prometheus.Histogram
}

// EnableCohortEnrichment installs the reserved-attribute scrub and, for allowed stacks, the
// GCOM resolver at the common proxy boundary. Without it request bodies are forwarded untouched.
func (b *APIBuilder) EnableCohortEnrichment(c CohortConfig, reg prometheus.Registerer) error {
	if len(c.AllowedNamespaces) == 0 {
		b.scrubCohorts = true
		return nil
	}
	u, err := url.Parse(c.URL)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return errors.New("cohort GCOM URL must be an absolute HTTPS URL without credentials, query or fragment")
	}
	if c.TokenFile == "" {
		return errors.New("cohort GCOM token file is required")
	}
	if c.Timeout <= 0 || c.Timeout > 5*time.Second || c.CacheTTL <= 0 || c.CacheTTL > 5*time.Minute || c.MaxSnapshotAge <= 0 || c.MaxEntries < 1 || c.MaxEntries > 100000 || c.MaxConcurrent < 1 || c.MaxConcurrent > 100 {
		return errors.New("invalid cohort lookup timeout, cache, freshness or concurrency limits")
	}
	resolver := newCohortResolver(c, u)
	for _, ns := range c.AllowedNamespaces {
		if _, ok := cohortStackID(ns); !ok {
			return fmt.Errorf("invalid cohort pilot namespace %q", ns)
		}
		resolver.allowed[ns] = true
	}
	if reg != nil {
		registered := []prometheus.Collector{}
		for _, collector := range []prometheus.Collector{resolver.outcomes, resolver.duration, resolver.age} {
			if err := reg.Register(collector); err != nil {
				for _, prior := range registered {
					reg.Unregister(prior)
				}
				return fmt.Errorf("register cohort metrics: %w", err)
			}
			registered = append(registered, collector)
		}
	}
	b.cohorts = resolver
	b.scrubCohorts = true
	return nil
}

func newCohortResolver(c CohortConfig, u *url.URL) *cohortResolver {
	return &cohortResolver{
		config:  c,
		baseURL: u,
		client: &http.Client{
			Timeout: c.Timeout,
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return errors.New("GCOM redirects are disabled")
			},
		},
		allowed:  map[string]bool{},
		cache:    map[string]*list.Element{},
		lru:      list.New(),
		inflight: map[string]chan struct{}{},
		slots:    make(chan struct{}, c.MaxConcurrent),
		now:      time.Now,
		outcomes: prometheus.NewCounterVec(prometheus.CounterOpts{Name: "grafana_ofrep_cohort_resolutions_total", Help: "Cohort resolution outcomes without tenant labels."}, []string{"outcome"}),
		duration: prometheus.NewHistogram(prometheus.HistogramOpts{Name: "grafana_ofrep_cohort_lookup_duration_seconds", Help: "Total GCOM organization and cohort lookup duration."}),
		age:      prometheus.NewHistogram(prometheus.HistogramOpts{Name: "grafana_ofrep_cohort_snapshot_age_seconds", Help: "Age of successfully served GCOM import snapshots.", Buckets: []float64{60, 300, 1800, 3600, 7200, 14400, 86400}}),
	}
}

func cohortStackID(namespace string) (string, bool) {
	id, ok := strings.CutPrefix(namespace, "stacks-")
	n, err := strconv.ParseUint(id, 10, 63)
	return id, ok && err == nil && n > 0 && strconv.FormatUint(n, 10) == id
}

func (c *cohortResolver) fresh(s cohortSnapshot) bool {
	if s.Snapshot == nil || s.Snapshot.Version == "" || s.orgID == "" {
		return false
	}
	age := c.now().Sub(s.Snapshot.RefreshedAt)
	return age >= -time.Minute && age <= c.config.MaxSnapshotAge
}

func (c *cohortResolver) resolve(ctx context.Context, namespace string) cohortSnapshot {
	ctx, cancel := context.WithTimeout(ctx, c.config.Timeout)
	defer cancel()
	for {
		c.mu.Lock()
		if e := c.cache[namespace]; e != nil {
			entry := e.Value.(cohortCacheEntry)
			if c.now().Before(entry.expires) {
				c.lru.MoveToFront(e)
				c.mu.Unlock()
				c.outcomes.WithLabelValues("cache_hit").Inc()
				return entry.value
			}
			c.lru.Remove(e)
			delete(c.cache, namespace)
		}
		if done := c.inflight[namespace]; done != nil {
			c.mu.Unlock()
			select {
			case <-done:
				continue
			case <-ctx.Done():
				c.outcomes.WithLabelValues("timeout").Inc()
				return cohortSnapshot{}
			}
		}
		select {
		case c.slots <- struct{}{}:
		default:
			c.mu.Unlock()
			c.outcomes.WithLabelValues("saturated").Inc()
			return cohortSnapshot{}
		}
		done := make(chan struct{})
		c.inflight[namespace] = done
		c.mu.Unlock()
		start := time.Now()
		value, err := c.fetch(ctx, namespace)
		c.duration.Observe(time.Since(start).Seconds())
		ttl := c.config.CacheTTL
		if err != nil {
			value = cohortSnapshot{}
			ttl = min(ttl, time.Second)
			c.outcomes.WithLabelValues("lookup_error").Inc()
		} else {
			c.outcomes.WithLabelValues("lookup_success").Inc()
		}
		c.mu.Lock()
		c.cache[namespace] = c.lru.PushFront(cohortCacheEntry{namespace: namespace, value: value, expires: c.now().Add(ttl)})
		if c.lru.Len() > c.config.MaxEntries {
			last := c.lru.Back()
			delete(c.cache, last.Value.(cohortCacheEntry).namespace)
			c.lru.Remove(last)
		}
		delete(c.inflight, namespace)
		close(done)
		<-c.slots
		c.mu.Unlock()
		return value
	}
}

func (c *cohortResolver) get(ctx context.Context, path string, dst any) error {
	token, err := os.ReadFile(c.config.TokenFile) //nolint:gosec // The path is operator configuration, not request input.
	if err != nil {
		return errors.New("cannot read GCOM token file")
	}
	bearer := strings.TrimSpace(string(token))
	if bearer == "" || strings.ContainsAny(bearer, "\r\n") {
		return errors.New("invalid GCOM token")
	}
	u := *c.baseURL
	u.Path = strings.TrimRight(u.Path, "/") + path
	// The base URL is validated at startup and path segments are canonical numeric IDs.
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil) //nolint:gosec
	if err != nil {
		return errors.New("invalid GCOM request")
	}
	req.Header.Set("Authorization", "Bearer "+bearer)
	resp, err := c.client.Do(req) //nolint:gosec // See above; redirects are disabled.
	if err != nil {
		return errors.New("GCOM request failed")
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("GCOM returned status %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, mib+1))
	if err != nil || len(data) > mib {
		return errors.New("invalid GCOM response size")
	}
	return json.Unmarshal(data, dst)
}

func (c *cohortResolver) fetch(ctx context.Context, namespace string) (cohortSnapshot, error) {
	stackID, ok := cohortStackID(namespace)
	if !ok {
		return cohortSnapshot{}, errors.New("invalid stack")
	}
	var instance struct {
		OrgID json.Number `json:"orgId"`
	}
	if err := c.get(ctx, "/instances/"+stackID, &instance); err != nil {
		return cohortSnapshot{}, err
	}
	orgID, err := instance.OrgID.Int64()
	if err != nil || orgID <= 0 {
		return cohortSnapshot{}, errors.New("missing organization")
	}
	var snapshot cohortSnapshot
	if err := c.get(ctx, "/growth/cohorts/"+strconv.FormatInt(orgID, 10), &snapshot); err != nil {
		return cohortSnapshot{}, err
	}
	snapshot.orgID = strconv.FormatInt(orgID, 10)
	if snapshot.Cohorts == nil || len(snapshot.Cohorts) > 1000 {
		return cohortSnapshot{}, errors.New("invalid cohort membership")
	}
	for _, cohort := range snapshot.Cohorts {
		if cohort == "" || len(cohort) > 256 {
			return cohortSnapshot{}, errors.New("invalid cohort name")
		}
	}
	return snapshot, nil
}

// cohortIdentityTypes are the callers that reach MTFF with a stack identity: signed-in users and
// service accounts (Grafana router or ID token) and access-policy tokens (token exchange).
// Anonymous, public-dashboard and render identities also carry a stack namespace but are not
// acting for the organization, so they must not be enriched.
var cohortIdentityTypes = []types.IdentityType{types.TypeUser, types.TypeServiceAccount, types.TypeAccessPolicy}

var cohortReservedAttributes = []string{"growthCohorts", "growthCohortsAvailable", "growthCohortsVersion", "growthCohortsRefreshedAt"}

// enrichCohorts replaces reserved attributes once EnableCohortEnrichment has been called,
// including when lookups are disabled or unavailable. Only an allowed authenticated namespace
// can authorize an organization lookup.
func (b *APIBuilder) enrichCohorts(r *http.Request) error {
	if !b.scrubCohorts {
		return nil
	}
	data, err := io.ReadAll(r.Body)
	if err != nil {
		return err
	}
	body := map[string]json.RawMessage{}
	if len(bytes.TrimSpace(data)) > 0 {
		if err := json.Unmarshal(data, &body); err != nil {
			return err
		}
	}
	if body == nil {
		body = map[string]json.RawMessage{}
	}
	// encoding/json matches struct fields case-insensitively, so GOFF and namespace validation
	// would read a variant such as "Context" that this scrub cannot see. Reject rather than
	// guess which duplicate a decoder would pick.
	for k := range body {
		if k != "context" && strings.EqualFold(k, "context") {
			return errors.New("non-canonical evaluation context key")
		}
	}
	attrs := map[string]json.RawMessage{}
	if raw := body["context"]; len(raw) > 0 {
		if err := json.Unmarshal(raw, &attrs); err != nil {
			return err
		}
	}
	if attrs == nil {
		attrs = map[string]json.RawMessage{}
	}
	for k := range attrs {
		for _, name := range cohortReservedAttributes {
			if strings.EqualFold(k, name) {
				delete(attrs, k)
			}
		}
	}
	attrs["growthCohorts"] = json.RawMessage(`[]`)
	attrs["growthCohortsAvailable"] = json.RawMessage(`false`)
	if c := b.cohorts; c != nil {
		user, ok := types.AuthInfoFrom(r.Context())
		if ok && types.IsIdentityType(user.GetIdentityType(), cohortIdentityTypes...) && c.allowed[user.GetNamespace()] {
			value := c.resolve(r.Context(), user.GetNamespace())
			if c.fresh(value) {
				attrs["growthCohorts"], _ = json.Marshal(value.Cohorts)
				attrs["growthCohortsAvailable"] = json.RawMessage(`true`)
				attrs["growthCohortsVersion"], _ = json.Marshal(value.Snapshot.Version)
				attrs["growthCohortsRefreshedAt"], _ = json.Marshal(value.Snapshot.RefreshedAt)
				attrs["gcomOrgID"], _ = json.Marshal(value.orgID)
				c.age.Observe(max(0, c.now().Sub(value.Snapshot.RefreshedAt).Seconds()))
			} else {
				c.outcomes.WithLabelValues("unavailable").Inc()
			}
		}
	}
	body["context"], err = json.Marshal(attrs)
	if err != nil {
		return err
	}
	encoded, err := json.Marshal(body)
	if err != nil {
		return err
	}
	r.Body = io.NopCloser(bytes.NewReader(encoded))
	r.ContentLength = int64(len(encoded))
	r.GetBody = func() (io.ReadCloser, error) { return io.NopCloser(bytes.NewReader(encoded)), nil }
	return nil
}

package ofrep

import (
	"bytes"
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
	"go.opentelemetry.io/otel/attribute"
	"golang.org/x/time/rate"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

const (
	// cohortOrgTTL is how long a stack-to-organization mapping is reused. Mappings change far less
	// often than memberships, and memberships are cached per organization with CacheTTL.
	cohortOrgTTL = 10 * time.Minute
	// cohortRetryInterval limits GCOM refreshes per key while lookups fail.
	cohortRetryInterval  = time.Second
	maxCohortSnapshotAge = 24 * time.Hour
	// cohortFlagConfigTTL is how long the cohort-targeting flag keys learned from GOFF are reused.
	// A newly marked flag is evaluated without cohorts, so excludes everyone, for at most this long.
	cohortFlagConfigTTL = 30 * time.Second
	// maxCohortFlagConfigBytes bounds the GOFF flag configuration response. The deployed flags come
	// from one ConfigMap, which Kubernetes limits to 1 MiB of YAML.
	maxCohortFlagConfigBytes = 4 * mib
	cohortFlagConfigPath     = "/v1/flag/configuration"
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
	MaxConcurrent     int
}

// cohortSnapshot ignores the optional snapshot.sourceRefreshedAt: GCOM refuses to publish from
// stale sources, so refreshedAt alone bounds freshness here.
type cohortSnapshot struct {
	Cohorts  []string `json:"cohorts"`
	Snapshot *struct {
		Version     string    `json:"version"`
		RefreshedAt time.Time `json:"refreshedAt"`
	} `json:"snapshot"`
	orgID string
}

// cohortError carries a fixed-set reason for metrics and logs. Messages never include the token.
type cohortError struct {
	reason string
	err    error
}

func (e *cohortError) Error() string { return e.err.Error() }
func (e *cohortError) Unwrap() error { return e.err }

func newCohortError(reason, msg string) error {
	return &cohortError{reason: reason, err: errors.New(msg)}
}

func cohortReason(err error) string {
	if ce, ok := errors.AsType[*cohortError](err); ok {
		return ce.reason
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "timeout"
	}
	return "internal"
}

// cohortStatus is the per-request outcome: cache_hit, lookup_success, stale (last good value
// served after a failed refresh) or unavailable, with the failure reason or "none".
type cohortStatus struct {
	outcome string
	reason  string
}

var cohortOutcomeRank = map[string]int{"cache_hit": 0, "lookup_success": 1, "stale": 2, "unavailable": 3}

func (s cohortStatus) worse(o cohortStatus) cohortStatus {
	if cohortOutcomeRank[o.outcome] > cohortOutcomeRank[s.outcome] {
		return o
	}
	return s
}

// cohortEntry is one cached lookup, guarded by cohortResolver.mu. A failed refresh keeps the last
// good value so callers can keep serving it; memberships are still bounded by MaxSnapshotAge.
type cohortEntry[V any] struct {
	value   V
	ok      bool
	expires time.Time
	retry   time.Time
	reason  string
	done    chan struct{}
}

func (e *cohortEntry[V]) fallback(reason string) (V, cohortStatus) {
	if e.ok {
		return e.value, cohortStatus{"stale", reason}
	}
	var zero V
	return zero, cohortStatus{"unavailable", reason}
}

// cohortFlagIndex caches the keys of GOFF flags whose metadata sets cohortTargeting, guarded by
// cohortResolver.mu. The keys map is replaced, never mutated, so callers may read it unlocked.
type cohortFlagIndex struct {
	keys    map[string]bool
	expires time.Time
	retry   time.Time
	reason  string
	done    chan struct{}
}

type cohortResolver struct {
	config      CohortConfig
	baseURL     *url.URL
	client      *http.Client
	allowed     map[string]bool
	mu          sync.Mutex
	orgs        map[string]*cohortEntry[string]
	memberships map[string]*cohortEntry[cohortSnapshot]
	flags       cohortFlagIndex
	slots       chan struct{}
	now         func() time.Time
	logger      log.Logger
	warnLimit   *rate.Sometimes
	flagWarn    *rate.Sometimes
	outcomes    *prometheus.CounterVec
	fallbacks   *prometheus.CounterVec
	duration    prometheus.Histogram
	age         prometheus.Histogram
}

// EnableCohortEnrichment installs the reserved-attribute scrub and, for allowed stacks, the
// GCOM resolver at the common proxy boundary. Without it request bodies are forwarded untouched.
// Lookups are skipped for requests that cannot evaluate a flag marked cohortTargeting, as read
// from the GOFF URL given to EnableLegacyOverrideLookupBypass; without that URL every allowed
// request is looked up.
func (b *APIBuilder) EnableCohortEnrichment(c CohortConfig, reg prometheus.Registerer) error {
	if len(c.AllowedNamespaces) == 0 {
		b.scrubCohorts = true
		return nil
	}
	u, err := url.Parse(c.URL)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return errors.New("cohort GCOM URL must be an absolute HTTPS URL without credentials, query or fragment")
	}
	if c.Timeout <= 0 || c.Timeout > 5*time.Second || c.CacheTTL <= 0 || c.CacheTTL > 5*time.Minute || c.MaxSnapshotAge <= 0 || c.MaxSnapshotAge > maxCohortSnapshotAge || c.MaxConcurrent < 1 || c.MaxConcurrent > 100 {
		return errors.New("invalid cohort lookup timeout, cache, freshness or concurrency limits")
	}
	if c.TokenFile == "" {
		return errors.New("cohort GCOM token file is required")
	}
	if _, err := readCohortToken(c.TokenFile); err != nil {
		return fmt.Errorf("cohort GCOM token file: %w", err)
	}
	resolver := newCohortResolver(c, u)
	for _, ns := range c.AllowedNamespaces {
		if _, ok := cohortStackID(ns); !ok {
			return fmt.Errorf("invalid cohort pilot namespace %q", ns)
		}
		resolver.allowed[ns] = true
	}
	if reg != nil {
		if err := resolver.registerMetrics(reg); err != nil {
			return fmt.Errorf("register cohort metrics: %w", err)
		}
	}
	b.cohorts = resolver
	b.scrubCohorts = true
	return nil
}

func newCohortResolver(c CohortConfig, u *url.URL) *cohortResolver {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.MaxIdleConnsPerHost = max(c.MaxConcurrent, 2)
	return &cohortResolver{
		config:  c,
		baseURL: u,
		client: &http.Client{
			Transport: transport,
			Timeout:   c.Timeout,
			CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
				return errors.New("GCOM redirects are disabled")
			},
		},
		allowed:     map[string]bool{},
		orgs:        map[string]*cohortEntry[string]{},
		memberships: map[string]*cohortEntry[cohortSnapshot]{},
		slots:       make(chan struct{}, c.MaxConcurrent),
		now:         time.Now,
		logger:      log.New("grafana-apiserver.feature-flags.cohorts"),
		warnLimit:   &rate.Sometimes{Interval: 10 * time.Second},
		flagWarn:    &rate.Sometimes{Interval: time.Minute},
		outcomes:    prometheus.NewCounterVec(prometheus.CounterOpts{Name: "grafana_ofrep_cohort_resolutions_total", Help: "Cohort enrichment outcomes per allowed request, without tenant labels; skipped requests cannot evaluate a cohort-targeting flag."}, []string{"outcome", "reason"}),
		fallbacks:   prometheus.NewCounterVec(prometheus.CounterOpts{Name: "grafana_ofrep_cohort_flag_config_fallbacks_total", Help: "Allowed requests looked up in GCOM because the GOFF cohort-targeting flag configuration was unknown."}, []string{"reason"}),
		duration:    prometheus.NewHistogram(prometheus.HistogramOpts{Name: "grafana_ofrep_cohort_lookup_duration_seconds", Help: "Duration of each GCOM organization or membership lookup."}),
		age:         prometheus.NewHistogram(prometheus.HistogramOpts{Name: "grafana_ofrep_cohort_snapshot_age_seconds", Help: "Age of successfully served GCOM import snapshots.", Buckets: []float64{60, 300, 1800, 3600, 7200, 14400, 86400}}),
	}
}

// registerMetrics reuses collectors that are already registered, for example when the builder is
// recreated in-process, and rolls back its own registrations on failure.
func (c *cohortResolver) registerMetrics(reg prometheus.Registerer) error {
	var added []prometheus.Collector
	var err error
	c.outcomes, err = registerCohortMetric(reg, &added, c.outcomes)
	if err == nil {
		c.fallbacks, err = registerCohortMetric(reg, &added, c.fallbacks)
	}
	if err == nil {
		c.duration, err = registerCohortMetric(reg, &added, c.duration)
	}
	if err == nil {
		c.age, err = registerCohortMetric(reg, &added, c.age)
	}
	if err != nil {
		for _, collector := range added {
			reg.Unregister(collector)
		}
	}
	return err
}

func registerCohortMetric[T prometheus.Collector](reg prometheus.Registerer, added *[]prometheus.Collector, collector T) (T, error) {
	err := reg.Register(collector)
	if are, ok := errors.AsType[prometheus.AlreadyRegisteredError](err); ok {
		if existing, ok := are.ExistingCollector.(T); ok {
			return existing, nil
		}
	}
	if err == nil {
		*added = append(*added, collector)
	}
	return collector, err
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

// resolve maps the stack to its organization, then the organization to its membership, so all
// stacks of an organization share one cached snapshot.
func (c *cohortResolver) resolve(ctx context.Context, namespace string) (cohortSnapshot, cohortStatus) {
	ctx, cancel := context.WithTimeout(ctx, c.config.Timeout)
	defer cancel()
	orgID, orgStatus := cohortLookup(c, ctx, c.orgs, namespace, cohortOrgTTL, "organization", func(ctx context.Context) (string, error) {
		return c.fetchOrg(ctx, namespace)
	})
	if orgStatus.outcome == "unavailable" {
		return cohortSnapshot{}, orgStatus
	}
	value, status := cohortLookup(c, ctx, c.memberships, orgID, c.config.CacheTTL, "membership", func(ctx context.Context) (cohortSnapshot, error) {
		return c.fetchMembership(ctx, orgID)
	})
	return value, orgStatus.worse(status)
}

// cohortLookup serves a cached value or coalesces one refresh per key. The refresh runs detached
// from any single caller, so a cancelled request cannot fail it for others, while every caller
// still stops waiting at its own deadline.
func cohortLookup[V any](c *cohortResolver, ctx context.Context, entries map[string]*cohortEntry[V], key string, ttl time.Duration, kind string, fetch func(context.Context) (V, error)) (V, cohortStatus) {
	c.mu.Lock()
	e := entries[key]
	if e == nil {
		e = &cohortEntry[V]{}
		entries[key] = e
	}
	now := c.now()
	if e.ok && now.Before(e.expires) {
		defer c.mu.Unlock()
		return e.value, cohortStatus{"cache_hit", "none"}
	}
	if e.done == nil {
		if now.Before(e.retry) {
			defer c.mu.Unlock()
			return e.fallback(e.reason)
		}
		select {
		case c.slots <- struct{}{}:
		default:
			defer c.mu.Unlock()
			return e.fallback("saturated")
		}
		e.done = make(chan struct{})
		go e.refresh(c, context.WithoutCancel(ctx), ttl, kind, fetch)
	}
	done := e.done
	c.mu.Unlock()

	select {
	case <-done:
	case <-ctx.Done():
		c.mu.Lock()
		defer c.mu.Unlock()
		return e.fallback("timeout")
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if e.ok && c.now().Before(e.expires) {
		return e.value, cohortStatus{"lookup_success", "none"}
	}
	return e.fallback(e.reason)
}

func (e *cohortEntry[V]) refresh(c *cohortResolver, ctx context.Context, ttl time.Duration, kind string, fetch func(context.Context) (V, error)) {
	ctx, cancel := context.WithTimeout(ctx, c.config.Timeout)
	ctx, span := tracing.Start(ctx, "ofrep.cohorts.fetch", attribute.String("kind", kind))
	start := time.Now()
	var value V
	var err error
	defer func() {
		if p := recover(); p != nil {
			err = newCohortError("internal", fmt.Sprintf("cohort lookup panic: %v", p))
		}
		cancel()
		c.duration.Observe(time.Since(start).Seconds())
		reason := ""
		if err != nil {
			reason = cohortReason(err)
			span.SetAttributes(attribute.String("reason", reason))
			_ = tracing.Error(span, err)
			c.warnLimit.Do(func() {
				c.logger.Warn("GCOM cohort lookup failed; serving last good value where available", "kind", kind, "reason", reason, "error", err)
			})
		}
		span.End()

		c.mu.Lock()
		if err == nil {
			e.value, e.ok, e.expires, e.retry, e.reason = value, true, c.now().Add(ttl), time.Time{}, ""
		} else {
			e.reason = reason
			if !errors.Is(err, context.Canceled) {
				e.retry = c.now().Add(cohortRetryInterval)
			}
		}
		close(e.done)
		e.done = nil
		c.mu.Unlock()
		<-c.slots
	}()
	value, err = fetch(ctx)
}

func readCohortToken(path string) (string, error) {
	token, err := os.ReadFile(path) //nolint:gosec // The path is operator configuration, not request input.
	if err != nil {
		return "", newCohortError("token_file", "cannot read GCOM token file")
	}
	bearer := strings.TrimSpace(string(token))
	if bearer == "" || strings.ContainsAny(bearer, "\r\n") {
		return "", newCohortError("token_file", "invalid GCOM token")
	}
	return bearer, nil
}

func (c *cohortResolver) get(ctx context.Context, path string, dst any) error {
	bearer, err := readCohortToken(c.config.TokenFile)
	if err != nil {
		return err
	}
	u := *c.baseURL
	u.Path = strings.TrimRight(u.Path, "/") + path
	// The base URL is validated at startup and path segments are canonical numeric IDs.
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil) //nolint:gosec
	if err != nil {
		return newCohortError("invalid", "invalid GCOM request")
	}
	req.Header.Set("Authorization", "Bearer "+bearer)
	return cohortDo(ctx, c.client, req, "GCOM", mib, dst)
}

// cohortDo sends one request and decodes a bounded JSON response, classifying failures by reason.
func cohortDo(ctx context.Context, client *http.Client, req *http.Request, upstream string, limit int, dst any) error {
	resp, err := client.Do(req) //nolint:gosec // Callers build the URL from operator configuration; redirects are disabled.
	if err != nil {
		if ctx.Err() != nil || os.IsTimeout(err) {
			return &cohortError{reason: "timeout", err: context.DeadlineExceeded}
		}
		// Drop the URL wrapper; the transport error alone classifies the failure.
		if ue, ok := errors.AsType[*url.Error](err); ok {
			err = ue.Err
		}
		return &cohortError{reason: "network", err: err}
	}
	defer func() { _ = resp.Body.Close() }()
	switch {
	case resp.StatusCode == http.StatusOK:
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		return newCohortError("auth", fmt.Sprintf("%s returned status %d", upstream, resp.StatusCode))
	case resp.StatusCode == http.StatusNotFound:
		return newCohortError("not_found", upstream+" returned status 404")
	case resp.StatusCode >= 500:
		return newCohortError("upstream_5xx", fmt.Sprintf("%s returned status %d", upstream, resp.StatusCode))
	default:
		return newCohortError("upstream_status", fmt.Sprintf("%s returned status %d", upstream, resp.StatusCode))
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, int64(limit)+1))
	if err != nil {
		if ctx.Err() != nil {
			return &cohortError{reason: "timeout", err: context.DeadlineExceeded}
		}
		return newCohortError("network", "cannot read "+upstream+" response")
	}
	if len(data) > limit {
		return newCohortError("invalid", fmt.Sprintf("%s response exceeds %d MiB", upstream, limit/mib))
	}
	if err := json.Unmarshal(data, dst); err != nil {
		return newCohortError("decode", "cannot decode "+upstream+" response")
	}
	return nil
}

func (c *cohortResolver) fetchOrg(ctx context.Context, namespace string) (string, error) {
	stackID, ok := cohortStackID(namespace)
	if !ok {
		return "", newCohortError("invalid", "invalid stack")
	}
	var instance struct {
		OrgID int64 `json:"orgId"`
	}
	if err := c.get(ctx, "/instances/"+stackID, &instance); err != nil {
		return "", err
	}
	if instance.OrgID <= 0 {
		return "", newCohortError("invalid", "missing organization")
	}
	return strconv.FormatInt(instance.OrgID, 10), nil
}

func (c *cohortResolver) fetchMembership(ctx context.Context, orgID string) (cohortSnapshot, error) {
	var snapshot cohortSnapshot
	if err := c.get(ctx, "/growth/cohorts/"+orgID, &snapshot); err != nil {
		return cohortSnapshot{}, err
	}
	if snapshot.Cohorts == nil || len(snapshot.Cohorts) > 1000 {
		return cohortSnapshot{}, newCohortError("invalid", "invalid cohort membership")
	}
	for _, cohort := range snapshot.Cohorts {
		if cohort == "" || len(cohort) > 256 {
			return cohortSnapshot{}, newCohortError("invalid", "invalid cohort name")
		}
	}
	snapshot.orgID = orgID
	return snapshot, nil
}

// cohortFlags returns the keys of GOFF flags marked cohortTargeting, refreshing them at most once
// at a time. The refresh runs detached from any single caller, like cohortLookup. When ok is false
// the keys are unknown and reason says why; callers then look up as if every flag used cohorts.
func (c *cohortResolver) cohortFlags(ctx context.Context, goffURL *url.URL, transport *http.Transport) (keys map[string]bool, reason string, ok bool) {
	if goffURL == nil {
		return nil, "not_configured", false
	}
	ctx, cancel := context.WithTimeout(ctx, c.config.Timeout)
	defer cancel()
	f := &c.flags
	c.mu.Lock()
	now := c.now()
	if now.Before(f.expires) {
		defer c.mu.Unlock()
		return f.keys, "", true
	}
	if f.done == nil {
		if now.Before(f.retry) {
			defer c.mu.Unlock()
			return nil, f.reason, false
		}
		f.done = make(chan struct{})
		go c.refreshFlags(context.WithoutCancel(ctx), goffURL, transport)
	}
	done := f.done
	c.mu.Unlock()

	select {
	case <-done:
	case <-ctx.Done():
		return nil, "timeout", false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.now().Before(f.expires) {
		return f.keys, "", true
	}
	return nil, f.reason, false
}

func (c *cohortResolver) refreshFlags(ctx context.Context, goffURL *url.URL, transport *http.Transport) {
	ctx, cancel := context.WithTimeout(ctx, c.config.Timeout)
	ctx, span := tracing.Start(ctx, "ofrep.cohorts.flagConfiguration")
	var keys map[string]bool
	var err error
	defer func() {
		if p := recover(); p != nil {
			err = newCohortError("internal", fmt.Sprintf("cohort flag configuration panic: %v", p))
		}
		cancel()
		reason := ""
		if err != nil {
			reason = cohortReason(err)
			span.SetAttributes(attribute.String("reason", reason))
			_ = tracing.Error(span, err)
			c.flagWarn.Do(func() {
				c.logger.Warn("GOFF flag configuration fetch failed; looking up cohorts for every allowed request", "reason", reason, "error", err)
			})
		} else {
			span.SetAttributes(attribute.Int("cohort_flags", len(keys)))
		}
		span.End()

		c.mu.Lock()
		f := &c.flags
		if err == nil {
			f.keys, f.expires, f.retry, f.reason = keys, c.now().Add(cohortFlagConfigTTL), time.Time{}, ""
		} else {
			f.reason, f.retry = reason, c.now().Add(cohortRetryInterval)
		}
		close(f.done)
		f.done = nil
		c.mu.Unlock()
	}()
	keys, err = c.fetchCohortFlags(ctx, goffURL, transport)
}

// fetchCohortFlags reads every flag from the relay proxy's flag configuration endpoint, which
// shares the OFREP routes' authentication, and keeps the keys whose metadata sets cohortTargeting.
func (c *cohortResolver) fetchCohortFlags(ctx context.Context, goffURL *url.URL, transport *http.Transport) (map[string]bool, error) {
	// Like the evaluation proxy, only the scheme and host of the GOFF URL are used.
	u := url.URL{Scheme: goffURL.Scheme, Host: goffURL.Host, Path: cohortFlagConfigPath}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u.String(), strings.NewReader(`{}`))
	if err != nil {
		return nil, newCohortError("invalid", "invalid GOFF request")
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{
		Timeout: c.config.Timeout,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return errors.New("GOFF redirects are disabled")
		},
	}
	if transport != nil {
		client.Transport = transport
	}
	var config struct {
		Flags map[string]struct {
			Metadata map[string]any `json:"metadata"`
		} `json:"flags"`
		ErrorCode string `json:"errorCode"`
	}
	if err := cohortDo(ctx, client, req, "GOFF", maxCohortFlagConfigBytes, &config); err != nil {
		return nil, err
	}
	if config.ErrorCode != "" {
		return nil, newCohortError("invalid", "GOFF flag configuration error")
	}
	keys := map[string]bool{}
	for key, flag := range config.Flags {
		if metadataBool(flag.Metadata, "cohortTargeting") {
			keys[key] = true
		}
	}
	return keys, nil
}

// cohortIdentityTypes are the callers that reach MTFF with a stack identity: signed-in users and
// service accounts (Grafana router or ID token) and access-policy tokens (token exchange).
// Anonymous, public-dashboard and render identities also carry a stack namespace but are not
// acting for the organization, so they must not be enriched.
var cohortIdentityTypes = []types.IdentityType{types.TypeUser, types.TypeServiceAccount, types.TypeAccessPolicy}

var cohortReservedAttributes = []string{"growthCohorts", "growthCohortsAvailable", "growthCohortsVersion", "growthCohortsRefreshedAt"}

// enrichCohorts replaces reserved attributes once EnableCohortEnrichment has been called,
// including when lookups are disabled, skipped or unavailable. Only an allowed authenticated
// namespace can authorize an organization lookup, and only for a request that may evaluate a
// cohort-targeting flag. flagKey is empty for bulk evaluation.
func (b *APIBuilder) enrichCohorts(r *http.Request, flagKey string) error {
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
			if b.mayEvaluateCohortFlag(r.Context(), c, flagKey) {
				c.enrich(r.Context(), user.GetNamespace(), attrs)
			} else {
				c.outcomes.WithLabelValues("skipped", "no_cohort_flags").Inc()
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

// enrich sets the organization's cohorts on attrs when a fresh snapshot is available.
func (c *cohortResolver) enrich(ctx context.Context, namespace string, attrs map[string]json.RawMessage) {
	value, status := c.resolve(ctx, namespace)
	if c.fresh(value) {
		attrs["growthCohorts"], _ = json.Marshal(value.Cohorts)
		attrs["growthCohortsAvailable"] = json.RawMessage(`true`)
		attrs["growthCohortsVersion"], _ = json.Marshal(value.Snapshot.Version)
		attrs["growthCohortsRefreshedAt"], _ = json.Marshal(value.Snapshot.RefreshedAt)
		attrs["gcomOrgID"], _ = json.Marshal(value.orgID)
		c.age.Observe(max(0, c.now().Sub(value.Snapshot.RefreshedAt).Seconds()))
	} else if status.outcome != "unavailable" {
		// A cached or stale value whose GCOM import snapshot is missing or too old. A
		// stale value keeps the failure that prevented its refresh.
		reason := "snapshot"
		if status.outcome == "stale" {
			reason = status.reason
		}
		status = cohortStatus{"unavailable", reason}
	}
	c.outcomes.WithLabelValues(status.outcome, status.reason).Inc()
}

// mayEvaluateCohortFlag reports whether the request may evaluate a flag marked cohortTargeting.
// flagKey is empty for bulk evaluation, which evaluates every flag. A skipped lookup keeps the
// scrubbed defaults, so a wrong answer can only exclude, never enroll.
func (b *APIBuilder) mayEvaluateCohortFlag(ctx context.Context, c *cohortResolver, flagKey string) bool {
	keys, reason, ok := c.cohortFlags(ctx, b.goffURL, b.transport)
	if !ok {
		c.fallbacks.WithLabelValues(reason).Inc()
		if reason == "not_configured" {
			c.flagWarn.Do(func() {
				c.logger.Warn("GOFF URL is not configured; looking up cohorts for every allowed request")
			})
		}
		return true
	}
	if flagKey == "" {
		return len(keys) > 0
	}
	return keys[flagKey]
}

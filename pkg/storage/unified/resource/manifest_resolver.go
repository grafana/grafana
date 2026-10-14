package resource

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"golang.org/x/sync/singleflight"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/transport"

	"github.com/grafana/grafana-app-sdk/app"
	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"

	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// The router publishes each served group's AppManifest under its discovery
// group, named by the API group, so one group's manifest is a single GET.
const routerManifestsPath = "/apis/discovery/" + appmanifestv1alpha2.APIVersion + "/manifests/"

const (
	// manifestFetchTimeout bounds one fetch so a hung request can't wedge every
	// caller waiting on it.
	manifestFetchTimeout = 30 * time.Second

	// maxManifestBytes bounds a manifest response. Manifests embed every
	// version's schema, but none come near this.
	maxManifestBytes = 16 << 20

	// A group the router has no manifest for is not asked about again until
	// this passes. Most groups have none, and without remembering that every
	// index build for one would wait on a request.
	defaultManifestMissTTL = 2 * time.Minute

	// Nothing pushes changes, so a group already known is re-checked in the
	// background once its answer is this old. The router answers an unchanged
	// manifest with a 304, so this is cheap.
	defaultManifestMaxAge = 10 * time.Minute

	// After a failed fetch a group is not retried for this long, so an
	// unreachable router costs one request per group per interval rather than
	// one per caller.
	defaultManifestRetryInterval = 30 * time.Second

	defaultManifestRouterAudience = "grafana"
)

// ManifestResolverConfig holds the connection settings for the Grafana router
// that publishes AppManifests.
type ManifestResolverConfig struct {
	// RouterURL is the base URL of the Grafana router.
	RouterURL string
	// Audience is the audience of the access tokens sent to the router.
	Audience string
	// Token is the system token used to sign access tokens.
	Token string
	// TokenExchangeURL is the URL used to exchange the system token for an access token.
	TokenExchangeURL string
	// CAFile is the path to a PEM-encoded CA bundle for verifying the router.
	CAFile string
	// AllowInsecure skips TLS verification (local dev only).
	AllowInsecure bool
	Log           log.Logger
}

// NewManifestResolverConfig builds a ManifestResolverConfig from Grafana
// settings and returns nil when the router URL, token, or token exchange URL
// are unset, so no remote router is called unless explicitly configured.
func NewManifestResolverConfig(cfg *setting.Cfg) *ManifestResolverConfig {
	logger := log.New("search-manifest-resolver")
	if cfg == nil {
		return nil
	}

	// These pointed at the app-platform apiserver, which can't fetch a manifest
	// by group; reading them as the router's would silently call the wrong server.
	us := cfg.SectionWithEnvOverrides("unified_storage")
	for _, key := range []string{"manifest_api_server_address", "manifest_watcher_ca_file", "manifest_watcher_allow_insecure_tls", "manifest_watcher_poll_interval"} {
		if us.Key(key).String() != "" {
			logger.Warn("setting is no longer read; search loads app manifests from the router (manifest_router_address)", "setting", key)
		}
	}

	grpcSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	allowInsecure := cfg.ManifestRouterAllowInsecureTLS
	if allowInsecure && cfg.Env != setting.Dev {
		logger.Error("manifest_router_allow_insecure_tls is set but app_mode is not 'development'; enforcing TLS verification", "app_mode", cfg.Env)
		allowInsecure = false
	}

	audience := strings.TrimSpace(cfg.ManifestRouterAudience)
	if audience == "" {
		audience = defaultManifestRouterAudience
	}

	rc := &ManifestResolverConfig{
		RouterURL:        strings.TrimRight(strings.TrimSpace(cfg.ManifestRouterAddress), "/"),
		Audience:         audience,
		Token:            strings.TrimSpace(grpcSection.Key("token").MustString("")),
		TokenExchangeURL: strings.TrimSpace(grpcSection.Key("token_exchange_url").MustString("")),
		CAFile:           strings.TrimSpace(cfg.ManifestRouterCAFile),
		AllowInsecure:    allowInsecure,
		Log:              logger,
	}

	if rc.RouterURL == "" {
		return nil
	}
	if rc.Token == "" || rc.TokenExchangeURL == "" {
		logger.Warn("manifest_router_address is set but grpc_client_authentication token or token_exchange_url is not; not calling the router")
		return nil
	}
	return rc
}

// ManifestResolver loads a group's AppManifest from the Grafana router the
// first time one of its kinds is needed, rather than on a timer. It implements
// ManifestKindResolver for the SearchFieldsRegistry, and publishes every set it
// loads through apply, which feeds both search fields and embedding config.
type ManifestResolver struct {
	log     log.Logger
	fetcher manifestFetcher
	apply   func([]*app.ManifestData) error
	builtin map[string]bool // groups compiled into this binary
	metrics *manifestResolverMetrics
	now     func() time.Time

	missTTL       time.Duration
	maxAge        time.Duration
	retryInterval time.Duration

	// One fetch per group at a time; concurrent callers share its result.
	fetches singleflight.Group
	// background runs revalidations nobody waits for; tests make it synchronous.
	background func(func())

	mu     sync.Mutex
	groups map[string]*manifestEntry

	// Publishing is serialized and always sends the latest snapshot, so two
	// groups fetched at once can't publish out of order.
	publishMu sync.Mutex
	// dirty is set when apply failed, so the next fetch publishes again even if
	// its own group did not change.
	dirty bool
}

// manifestEntry is what the router last said about one group.
type manifestEntry struct {
	manifest *app.ManifestData // nil when the router has no manifest for the group
	hash     string
	etag     string
	checked  time.Time // last answer from the router (200, 304 or 404)
	failed   time.Time // last failed fetch, for the retry interval
}

// manifestResolverMetrics are the resolver's Prometheus metrics. Built with a
// nil registerer in tests, which promauto treats as a no-op.
type manifestResolverMetrics struct {
	fetches     *prometheus.CounterVec
	reloads     prometheus.Counter
	manifests   prometheus.Gauge
	lastSuccess prometheus.Gauge
}

func newManifestResolverMetrics(reg prometheus.Registerer) *manifestResolverMetrics {
	return &manifestResolverMetrics{
		fetches: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "grafana_search_manifest_resolver_fetches_total",
			Help: "AppManifest fetches from the router by trigger (miss, revalidate) and result (found, not_modified, not_found, error).",
		}, []string{"trigger", "result"}),
		reloads: promauto.With(reg).NewCounter(prometheus.CounterOpts{
			Name: "grafana_search_manifest_resolver_reloads_total",
			Help: "Times the manifest resolver published a changed manifest set.",
		}),
		manifests: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Name: "grafana_search_manifest_resolver_manifests",
			Help: "Number of manifests the resolver has loaded from the router.",
		}),
		lastSuccess: promauto.With(reg).NewGauge(prometheus.GaugeOpts{
			Name: "grafana_search_manifest_resolver_last_success_timestamp_seconds",
			Help: "Unix time of the last fetch the router answered.",
		}),
	}
}

// newManifestRESTConfig builds a rest.Config that authenticates to the router
// via token exchange. The router verifies an authlib access token from the
// X-Access-Token header.
func newManifestRESTConfig(cfg ManifestResolverConfig) (*rest.Config, error) {
	var exchangeOpts []authnlib.ExchangeClientOpts
	if cfg.AllowInsecure {
		exchangeOpts = append(exchangeOpts, authnlib.WithHTTPClient(
			&http.Client{Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true, MinVersion: tls.VersionTLS13}, //nolint:gosec
			}},
		))
	}

	tc, err := authnlib.NewTokenExchangeClient(authnlib.TokenExchangeConfig{
		Token:            cfg.Token,
		TokenExchangeURL: cfg.TokenExchangeURL,
	}, exchangeOpts...)
	if err != nil {
		return nil, fmt.Errorf("creating token exchange client: %w", err)
	}

	return &rest.Config{
		Host:          cfg.RouterURL,
		Timeout:       manifestFetchTimeout,
		WrapTransport: manifestAuthWrapper(tc, cfg.Audience),
		TLSClientConfig: rest.TLSClientConfig{
			CAFile:   cfg.CAFile,
			Insecure: cfg.AllowInsecure && cfg.CAFile == "",
		},
	}, nil
}

// manifestAuthWrapper builds the transport wrapper used to reach the router,
// which authenticates the exchanged token from X-Access-Token.
func manifestAuthWrapper(exchanger authnlib.TokenExchanger, audience string) transport.WrapperFunc {
	return clientauth.NewStaticTokenExchangeTransportWrapper(exchanger, audience, clientauth.WildcardNamespace)
}

// NewManifestResolver creates a ManifestResolver. It makes no request until a
// kind is first resolved. builtin are the manifests compiled into this binary:
// their groups never wait on the router, though they are still fetched in the
// background so a router manifest can override them. apply receives every
// changed set.
func NewManifestResolver(cfg ManifestResolverConfig, reg prometheus.Registerer, builtin []*app.ManifestData, apply func([]*app.ManifestData) error) (*ManifestResolver, error) {
	restCfg, err := newManifestRESTConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("building manifest REST config: %w", err)
	}
	client, err := rest.HTTPClientFor(restCfg)
	if err != nil {
		return nil, fmt.Errorf("creating router client: %w", err)
	}

	r := newManifestResolver(&httpManifestFetcher{client: client, baseURL: cfg.RouterURL}, builtin, apply, cfg.Log)
	r.metrics = newManifestResolverMetrics(reg)
	return r, nil
}

// newManifestResolver builds the resolver with no-op metrics, so tests can
// drive it against a fake router.
func newManifestResolver(fetcher manifestFetcher, builtin []*app.ManifestData, apply func([]*app.ManifestData) error, logger log.Logger) *ManifestResolver {
	if logger == nil {
		logger = log.NewNopLogger()
	}
	if apply == nil {
		apply = func([]*app.ManifestData) error { return nil }
	}
	groups := map[string]bool{}
	for _, m := range builtin {
		if m != nil {
			groups[strings.ToLower(m.Group)] = true
		}
	}
	return &ManifestResolver{
		log:           logger,
		fetcher:       fetcher,
		apply:         apply,
		builtin:       groups,
		metrics:       newManifestResolverMetrics(nil),
		now:           time.Now,
		missTTL:       defaultManifestMissTTL,
		maxAge:        defaultManifestMaxAge,
		retryInterval: defaultManifestRetryInterval,
		background:    func(f func()) { go f() },
		groups:        map[string]*manifestEntry{},
	}
}

// Manifests returns the manifests loaded from the router, ordered by group.
func (r *ManifestResolver) Manifests() []*app.ManifestData {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.snapshotLocked()
}

// Ensure makes the published manifests include the router's manifest for
// key's group, if it has one. It waits only for a group it has no current
// answer for: one never asked about, or one the router had no manifest for
// when last asked. A group already loaded, or built in, is re-checked in the
// background once its answer is old. It never fails: on error the previous set
// stays published.
func (r *ManifestResolver) Ensure(ctx context.Context, key LowerGroupResource) {
	if r == nil || key.Group == "" {
		return
	}
	group := key.Group

	r.mu.Lock()
	now := r.now()
	e := r.groups[group]
	var found, answered bool
	var age time.Duration
	if e != nil && !e.checked.IsZero() {
		answered, found, age = true, e.manifest != nil, now.Sub(e.checked)
	}
	retrying := e != nil && !e.failed.IsZero() && now.Sub(e.failed) < r.retryInterval
	r.mu.Unlock()

	switch {
	case retrying:
		return
	case found || r.builtin[group]:
		// What is published already covers the group, so nobody waits.
		if !answered || age >= r.maxAge {
			r.background(func() {
				_, _, _ = r.fetches.Do(group, func() (any, error) {
					r.fetch(context.Background(), group, "revalidate")
					return nil, nil
				})
			})
		}
		return
	case answered && age < r.missTTL:
		return
	}

	// Callers asking for the same group share one fetch, which finishes even if
	// this caller gives up, so its answer is remembered for the next one.
	fetchCtx := context.WithoutCancel(ctx)
	select {
	case <-r.fetches.DoChan(group, func() (any, error) {
		r.fetch(fetchCtx, group, "miss")
		return nil, nil
	}):
	case <-ctx.Done():
	}
}

// fetch asks the router for group's manifest and publishes the set if it
// changed. A failed request or a manifest that fails to convert keeps what was
// published before: a router that is unreachable or mid-rollout must never
// drop search fields and force a needless reindex. A 404 is the router's
// answer, so a group it no longer serves is dropped.
func (r *ManifestResolver) fetch(ctx context.Context, group, trigger string) {
	ctx, cancel := context.WithTimeout(ctx, manifestFetchTimeout)
	defer cancel()

	r.mu.Lock()
	var etag string
	if e := r.groups[group]; e != nil && e.manifest != nil {
		etag = e.etag
	}
	r.mu.Unlock()

	resp, err := r.fetcher.fetch(ctx, group, etag)
	var hash string
	if err == nil && resp.status == http.StatusOK {
		hash, err = checkGroupManifest(group, resp.manifest)
	}
	if err != nil {
		r.metrics.fetches.WithLabelValues(trigger, "error").Inc()
		if errors.Is(err, ErrManifestSourceNotReady) {
			r.log.Debug("manifest resolver: source not ready, will retry", "group", group, "trigger", trigger)
		} else {
			r.log.Error("manifest resolver: fetch failed, keeping previous manifest", "group", group, "trigger", trigger, "error", err)
		}
		r.mu.Lock()
		r.entryLocked(group).failed = r.now()
		r.mu.Unlock()
		return
	}
	r.metrics.lastSuccess.SetToCurrentTime()

	r.mu.Lock()
	e := r.entryLocked(group)
	e.checked, e.failed = r.now(), time.Time{}
	changed := false
	switch resp.status {
	case http.StatusNotModified:
		r.metrics.fetches.WithLabelValues(trigger, "not_modified").Inc()
	case http.StatusNotFound:
		r.metrics.fetches.WithLabelValues(trigger, "not_found").Inc()
		changed = e.manifest != nil
		e.manifest, e.hash, e.etag = nil, "", ""
	default:
		r.metrics.fetches.WithLabelValues(trigger, "found").Inc()
		changed = hash != e.hash
		e.manifest, e.hash, e.etag = resp.manifest, hash, resp.etag
	}
	publish := changed || r.dirty
	r.mu.Unlock()

	if publish {
		r.publish(group, trigger)
	}
}

// publish sends the current snapshot to apply.
func (r *ManifestResolver) publish(group, trigger string) {
	r.publishMu.Lock()
	defer r.publishMu.Unlock()

	r.mu.Lock()
	manifests := r.snapshotLocked()
	r.dirty = false
	r.mu.Unlock()

	r.metrics.manifests.Set(float64(len(manifests)))
	if err := r.apply(manifests); err != nil {
		r.mu.Lock()
		r.dirty = true
		r.mu.Unlock()
		r.log.Error("manifest resolver: applying manifests failed, keeping current set", "group", group, "error", err)
		return
	}
	r.metrics.reloads.Inc()
	r.log.Info("manifest resolver published new manifest set", "group", group, "trigger", trigger, "manifests", len(manifests))
}

func (r *ManifestResolver) entryLocked(group string) *manifestEntry {
	e := r.groups[group]
	if e == nil {
		e = &manifestEntry{}
		r.groups[group] = e
	}
	return e
}

// snapshotLocked returns the loaded manifests ordered by group, so apply sees
// the same order for the same content.
func (r *ManifestResolver) snapshotLocked() []*app.ManifestData {
	names := make([]string, 0, len(r.groups))
	for group, e := range r.groups {
		if e.manifest != nil {
			names = append(names, group)
		}
	}
	sort.Strings(names)
	out := make([]*app.ManifestData, 0, len(names))
	for _, group := range names {
		out = append(out, r.groups[group].manifest)
	}
	return out
}

// decodeRouterManifest converts one AppManifest document from the router.
func decodeRouterManifest(body []byte) (*app.ManifestData, error) {
	obj := &unstructured.Unstructured{}
	if err := obj.UnmarshalJSON(body); err != nil {
		return nil, fmt.Errorf("decoding appmanifest: %w", err)
	}
	return ManifestFromUnstructured(obj)
}

// checkGroupManifest returns the hash of the manifest a source returned for
// group. Sources name each manifest by its group, so a mismatch means the wrong
// one came back.
func checkGroupManifest(group string, m *app.ManifestData) (string, error) {
	if m == nil {
		return "", errors.New("source returned no manifest")
	}
	if !strings.EqualFold(m.Group, group) {
		return "", fmt.Errorf("source returned the manifest for group %q", m.Group)
	}
	return hashManifest(m)
}

// ErrManifestSourceNotReady is returned by a source that can't answer yet,
// such as a router that hasn't loaded its routes. Like any failure it is
// retried, but it is expected at startup, so it isn't logged as an error.
var ErrManifestSourceNotReady = errors.New("manifest source not ready")

// manifestFetcher gets one group's AppManifest from the router.
type manifestFetcher interface {
	fetch(ctx context.Context, group, etag string) (manifestResponse, error)
}

// manifestResponse is the router's answer, in HTTP terms whether or not it
// came over HTTP: 200 with the manifest, 304 when etag still matches, or 404
// when it has no manifest for the group. Callers must not modify the manifest.
type manifestResponse struct {
	status   int
	etag     string
	manifest *app.ManifestData
}

type httpManifestFetcher struct {
	client  *http.Client
	baseURL string
}

func (f *httpManifestFetcher) fetch(ctx context.Context, group, etag string) (manifestResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, f.baseURL+routerManifestsPath+url.PathEscape(group), nil)
	if err != nil {
		return manifestResponse{}, err
	}
	req.Header.Set("Accept", "application/json")
	if etag != "" {
		req.Header.Set("If-None-Match", etag)
	}
	resp, err := f.client.Do(req)
	if err != nil {
		return manifestResponse{}, err
	}
	defer func() { _ = resp.Body.Close() }()

	switch resp.StatusCode {
	case http.StatusOK:
		body, err := io.ReadAll(io.LimitReader(resp.Body, maxManifestBytes+1))
		if err != nil {
			return manifestResponse{}, fmt.Errorf("reading manifest: %w", err)
		}
		if len(body) > maxManifestBytes {
			return manifestResponse{}, errors.New("manifest response too large")
		}
		m, err := decodeRouterManifest(body)
		if err != nil {
			return manifestResponse{}, err
		}
		return manifestResponse{status: resp.StatusCode, etag: resp.Header.Get("ETag"), manifest: m}, nil
	case http.StatusNotModified, http.StatusNotFound:
		return manifestResponse{status: resp.StatusCode}, nil
	default:
		return manifestResponse{}, fmt.Errorf("router responded %s", resp.Status)
	}
}

// ManifestFromUnstructured converts an AppManifest apiserver object (v1alpha2)
// to app.ManifestData.
//
// Exported so a server that reads AppManifests some other way gets the same
// conversion the resolver uses, rather than a second one that could disagree
// about what a manifest means.
func ManifestFromUnstructured(item *unstructured.Unstructured) (*app.ManifestData, error) {
	specRaw, ok := item.Object["spec"]
	if !ok {
		return nil, fmt.Errorf("appmanifest %q has no spec", item.GetName())
	}
	specJSON, err := json.Marshal(specRaw)
	if err != nil {
		return nil, fmt.Errorf("marshaling spec: %w", err)
	}
	var spec appmanifestv1alpha2.AppManifestSpec
	if err := json.Unmarshal(specJSON, &spec); err != nil {
		return nil, fmt.Errorf("unmarshaling spec: %w", err)
	}
	data, err := spec.ToManifestData()
	if err != nil {
		return nil, fmt.Errorf("converting spec to manifest data: %w", err)
	}
	return &data, nil
}

// hashManifest returns a stable hash of a manifest, used to skip publishing
// when the router returns the same content under a new ETag.
func hashManifest(m *app.ManifestData) (string, error) {
	b, err := json.Marshal(m)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(b)
	return fmt.Sprintf("%x", sum), nil
}

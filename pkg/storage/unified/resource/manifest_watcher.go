package resource

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/grafana/dskit/services"

	authnlib "github.com/grafana/authlib/authn"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/transport"

	"github.com/grafana/grafana-app-sdk/app"
	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"

	"github.com/grafana/grafana/pkg/clientauth"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// v1alpha2 is the only version with SearchFields.
var appManifestGVR = schema.GroupVersionResource{
	Group:    "apps.grafana.app",
	Version:  "v1alpha2",
	Resource: "appmanifests",
}

// manifestPollTimeout bounds one poll cycle so a hung request can't wedge the
// watcher: without it a stalled initial poll would block reaching Running and a
// stalled later poll would block all retries.
const manifestPollTimeout = 1 * time.Minute

// ManifestWatcherConfig holds the connection settings for the app-platform
// apiserver that serves AppManifests.
type ManifestWatcherConfig struct {
	// APIServerURL is the URL of the app-platform apiserver serving AppManifests.
	APIServerURL string
	// Token is the system token used to sign access tokens.
	Token string
	// TokenExchangeURL is the URL used to exchange the system token for an access token.
	TokenExchangeURL string
	// CAFile is the path to a PEM-encoded CA bundle for verifying the apiserver.
	CAFile string
	// AllowInsecure skips TLS verification (local dev only).
	AllowInsecure bool
	// PollInterval is the delay between poll cycles. Defaults to 1 hour if zero.
	PollInterval time.Duration
	Log          log.Logger
}

// NewManifestWatcherConfig builds a ManifestWatcherConfig from Grafana settings
// and returns nil when the apiserver URL, token, or token exchange URL are
// unset, so the watcher stays off unless explicitly configured.
func NewManifestWatcherConfig(cfg *setting.Cfg) *ManifestWatcherConfig {
	logger := log.New("search-manifest-watcher")
	if cfg == nil {
		return nil
	}

	grpcSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	allowInsecure := cfg.ManifestWatcherAllowInsecureTLS
	if allowInsecure && cfg.Env != setting.Dev {
		logger.Error("manifest_watcher_allow_insecure_tls is set but app_mode is not 'development'; enforcing TLS verification", "app_mode", cfg.Env)
		allowInsecure = false
	}

	wc := &ManifestWatcherConfig{
		APIServerURL:     strings.TrimSpace(cfg.ManifestApiServerAddress),
		Token:            strings.TrimSpace(grpcSection.Key("token").MustString("")),
		TokenExchangeURL: strings.TrimSpace(grpcSection.Key("token_exchange_url").MustString("")),
		CAFile:           strings.TrimSpace(cfg.ManifestWatcherCAFile),
		AllowInsecure:    allowInsecure,
		PollInterval:     cfg.ManifestWatcherPollInterval,
		Log:              logger,
	}

	if wc.APIServerURL == "" || wc.Token == "" || wc.TokenExchangeURL == "" {
		logger.Warn("manifest watcher not configured - ensure manifest api server address, token, and token exchange url are set")
		return nil
	}
	return wc
}

// ManifestWatcher polls the app-platform apiserver for AppManifests and keeps a
// current snapshot. It only produces the live manifest set; it does not wire it
// into search.
type ManifestWatcher struct {
	services.Service

	log          log.Logger
	client       dynamic.Interface
	pollInterval time.Duration
	onChange     func([]app.Manifest)

	// byName is the current snapshot, keyed by apiserver object name. The name key
	// lets a poll keep a known manifest when the same object later fails to
	// convert. Manifests() derives the ordered slice from it.
	mu       sync.RWMutex
	byName   map[string]app.Manifest
	lastHash string
}

// newManifestRESTConfig builds a rest.Config that authenticates to the
// app-platform apiserver via token exchange, the same way the provisioning
// operator reaches app-platform apiservers.
func newManifestRESTConfig(cfg ManifestWatcherConfig) (*rest.Config, error) {
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
		APIPath:       "/apis",
		Host:          cfg.APIServerURL,
		Timeout:       manifestPollTimeout,
		WrapTransport: manifestAuthWrapper(tc),
		TLSClientConfig: rest.TLSClientConfig{
			CAFile:   cfg.CAFile,
			Insecure: cfg.AllowInsecure && cfg.CAFile == "",
		},
	}, nil
}

// manifestAuthWrapper builds the transport wrapper used to reach the app-platform
// apiserver. That server authenticates a standard bearer token from the
// Authorization header, so the exchanged token must go there rather than in the
// authlib X-Access-Token header. The token audience is the API group.
func manifestAuthWrapper(exchanger authnlib.TokenExchanger) transport.WrapperFunc {
	return clientauth.NewStaticTokenExchangeAuthorizationTransportWrapper(exchanger, appManifestGVR.Group, clientauth.WildcardNamespace)
}

// NewManifestWatcher creates a ManifestWatcher as a dskit service. The initial
// poll runs in the starting state, so anything that waits for Running observes a
// populated snapshot. onChange may be nil.
func NewManifestWatcher(cfg ManifestWatcherConfig, onChange func([]app.Manifest)) (*ManifestWatcher, error) {
	restCfg, err := newManifestRESTConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("building manifest REST config: %w", err)
	}

	client, err := dynamic.NewForConfig(restCfg)
	if err != nil {
		return nil, fmt.Errorf("creating dynamic client: %w", err)
	}

	interval := cfg.PollInterval
	if interval <= 0 {
		interval = defaultPollInterval
	}

	w := newManifestWatcher(client, interval, onChange, cfg.Log)
	w.Service = services.NewBasicService(w.starting, w.running, nil)
	return w, nil
}

// newManifestWatcher builds the watcher without a service, so tests can drive
// poll cycles directly.
func newManifestWatcher(client dynamic.Interface, pollInterval time.Duration, onChange func([]app.Manifest), logger log.Logger) *ManifestWatcher {
	if logger == nil {
		logger = log.NewNopLogger()
	}
	return &ManifestWatcher{
		log:          logger,
		client:       client,
		pollInterval: pollInterval,
		onChange:     onChange,
	}
}

// Manifests returns the current snapshot as an ordered slice.
func (w *ManifestWatcher) Manifests() []app.Manifest {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return sortedManifests(w.byName)
}

// starting runs the initial poll so callers that wait for Running see a
// populated snapshot. It never fails on an unreachable apiserver; the running
// loop retries.
func (w *ManifestWatcher) starting(ctx context.Context) error {
	w.runPollCycle(ctx)
	return nil
}

func (w *ManifestWatcher) running(ctx context.Context) error {
	ticker := time.NewTicker(w.pollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			w.runPollCycle(ctx)
		}
	}
}

// runPollCycle publishes the manifest set only if it changed. A failed list or
// an empty result keeps the previous snapshot: an unreachable or half-ready
// apiserver must never blank the live set, which would drop search fields and
// force a needless reindex.
func (w *ManifestWatcher) runPollCycle(ctx context.Context) {
	ctx, cancel := context.WithTimeout(ctx, manifestPollTimeout)
	defer cancel()

	w.mu.RLock()
	prev := w.byName
	w.mu.RUnlock()

	result, err := w.list(ctx, prev)
	if err != nil {
		w.log.Error("manifest watcher poll cycle: list failed, keeping previous set", "error", err)
		return
	}
	if len(result) == 0 {
		w.log.Warn("manifest watcher poll cycle: zero manifests, keeping previous set")
		return
	}

	manifests := sortedManifests(result)
	hash, err := hashManifests(manifests)
	if err != nil {
		// Can't dedupe without a hash, so publish rather than risk hiding a change.
		w.log.Warn("manifest watcher: hashing failed, publishing anyway", "error", err)
	}

	// Refresh the index on every successful poll, even when the content is
	// unchanged, so a rename (same spec, new object name) doesn't leave the
	// keep-previous lookup pointing at stale keys. Publishing stays gated on the
	// content hash so a pure rename doesn't trigger a needless reindex.
	w.mu.Lock()
	w.byName = result
	changed := err != nil || hash != w.lastHash
	if changed {
		w.lastHash = hash
	}
	w.mu.Unlock()

	if !changed {
		return
	}
	w.log.Info("manifest watcher published new manifest set", "manifests", len(manifests))
	if w.onChange != nil {
		w.onChange(manifests)
	}
}

// list pages through all AppManifests, keyed by apiserver object name. When an
// object fails to convert, its previously known version (from prev) is kept so a
// transient parse failure can't drop its search fields; a genuinely unknown
// object is skipped.
func (w *ManifestWatcher) list(ctx context.Context, prev map[string]app.Manifest) (map[string]app.Manifest, error) {
	result := make(map[string]app.Manifest)
	var continueToken string
	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		page, err := w.client.Resource(appManifestGVR).List(ctx, metav1.ListOptions{
			Limit:    pollPageSize,
			Continue: continueToken,
		})
		if err != nil {
			return nil, fmt.Errorf("listing appmanifests: %w", err)
		}
		for i := range page.Items {
			name := page.Items[i].GetName()
			m, err := manifestFromUnstructured(&page.Items[i])
			if err != nil {
				if p, ok := prev[name]; ok {
					w.log.Warn("manifest watcher: keeping previous manifest, this poll failed to convert it",
						"name", name, "error", err)
					result[name] = p
					continue
				}
				w.log.Warn("manifest watcher: skipping unknown manifest that failed to convert",
					"name", name, "error", err)
				continue
			}
			result[name] = m
		}
		continueToken = page.GetContinue()
		if continueToken == "" {
			break
		}
	}
	return result, nil
}

// sortedManifests returns the map values ordered by apiserver object name. The
// name is unique, so the published snapshot and its hash are deterministic even
// when two objects share a group and app name.
func sortedManifests(byName map[string]app.Manifest) []app.Manifest {
	names := make([]string, 0, len(byName))
	for name := range byName {
		names = append(names, name)
	}
	sort.Strings(names)
	out := make([]app.Manifest, 0, len(byName))
	for _, name := range names {
		out = append(out, byName[name])
	}
	return out
}

// manifestFromUnstructured converts an AppManifest apiserver object (v1alpha2)
// to an app.Manifest.
func manifestFromUnstructured(item *unstructured.Unstructured) (app.Manifest, error) {
	specRaw, ok := item.Object["spec"]
	if !ok {
		return app.Manifest{}, fmt.Errorf("appmanifest %q has no spec", item.GetName())
	}
	specJSON, err := json.Marshal(specRaw)
	if err != nil {
		return app.Manifest{}, fmt.Errorf("marshaling spec: %w", err)
	}
	var spec appmanifestv1alpha2.AppManifestSpec
	if err := json.Unmarshal(specJSON, &spec); err != nil {
		return app.Manifest{}, fmt.Errorf("unmarshaling spec: %w", err)
	}
	data, err := spec.ToManifestData()
	if err != nil {
		return app.Manifest{}, fmt.Errorf("converting spec to manifest data: %w", err)
	}
	return app.NewEmbeddedManifest(data), nil
}

// hashManifests returns a stable hash of the manifest set, used to skip
// publishing when a poll returns no real change. The input is already ordered by
// sortedManifests (by unique object name), so the hash is deterministic.
func hashManifests(manifests []app.Manifest) (string, error) {
	datas := make([]app.ManifestData, 0, len(manifests))
	for _, m := range manifests {
		if m.ManifestData != nil {
			datas = append(datas, *m.ManifestData)
		}
	}
	b, err := json.Marshal(datas)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(b)
	return fmt.Sprintf("%x", sum), nil
}

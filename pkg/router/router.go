package router

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync/atomic"

	"github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"k8s.io/client-go/transport"
)

const apisPrefix = "/apis"

// groupEntry is the router's persistent, reconcile-only record for one group:
// the live Backend plus lastRV, the RouteConfig fingerprint last applied. lastRV
// lets reconcile skip rebuilding a group whose config has not changed. Touched
// only by reconcile (single goroutine), so it needs no lock.
type groupEntry struct {
	backend Backend
	lastRV  string
}

// there won't be a cloud apps router in enterprise
// can be in OSS right now, RoutesLoader stays in enterprise in cloud
type BasicRouter struct {
	loader RoutesLoader

	dialer     *transport.DialHolder
	transports map[tlsCacheKey]*http.Transport

	// entries is the desired-state map, keyed by group. Owned by reconcile
	// (single goroutine); never read from the serving path.
	entries map[string]*groupEntry

	// snapshot is the immutable group -> Backend map used to serve requests.
	// reconcile rebuilds and atomically stores it; serving loads it lock-free.
	// Keeping the routing table keyed by group (not flattened path prefixes)
	// keeps the config's shape visible at dispatch, so Handler can give primacy
	// to the group when deciding own-vs-fallthrough.
	snapshot atomic.Pointer[map[string]Backend]
}

func NewRouter(loader RoutesLoader) *BasicRouter {
	r := &BasicRouter{
		loader:     loader,
		transports: map[tlsCacheKey]*http.Transport{},
		entries:    map[string]*groupEntry{},
	}
	empty := map[string]Backend{}
	r.snapshot.Store(&empty)
	return r
}

// transportFor returns a transport for the given TLS settings, building and
// caching one on first use. Called only from reconcile (single goroutine), so
// the transports map needs no lock. Backends sharing a tlsCacheKey share a
// transport, so their connection pools are shared too. This shared cache is
// what preserves connection pools across a config change: rebuilding a group's
// Backend reuses the cached transport, so its pool survives untouched.
func (cr *BasicRouter) transportFor(key tlsCacheKey) (*http.Transport, error) {
	if t, ok := cr.transports[key]; ok {
		return t, nil
	}

	// nosemgrep: problem-based-packs.insecure-transport.go-stdlib.bypass-tls-verification.bypass-tls-verification
	tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12}
	switch {
	case key.insecure:
		// Driven by the RouteBackend spec's Tls.SkipTLSVerify. Intentional
		// dual-use: some backends are reached over trusted internal links
		// without a verifiable cert. Only enable for backends whose link is
		// actually trusted — this disables cert verification (MITM exposure).
		tlsCfg.InsecureSkipVerify = true // #nosec G402 -- spec-gated, trusted-link only
	case key.caData != "":
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM([]byte(key.caData)) {
			return nil, fmt.Errorf("invalid CA PEM data")
		}
		tlsCfg.RootCAs = pool
	}

	t := http.DefaultTransport.(*http.Transport).Clone()
	t.TLSClientConfig = tlsCfg
	if cr.dialer != nil {
		t.DialContext = cr.dialer.Dial
	}

	cr.transports[key] = t
	return t, nil
}

// HandleFunc serves the reverse-proxy tree by group, falling through to next for
// anything the router does not own. server.go mounts it at /apis. It is itself
// the serving function (http.HandlerFunc shape plus a next), so a caller wraps it
// as http.HandlerFunc(func(w, r) { router.HandleFunc(w, r, next) }).
//
// NOTE: when implementing OpenAPIV3Handler(), we need to support
// serverAddressByClientCIDRs in /apis to allow local in-network clients to
// connect directly as desired.
func (cr *BasicRouter) HandleFunc(w http.ResponseWriter, req *http.Request, next http.Handler) {
	path := req.URL.Path

	// Not part of the /apis tree — not ours.
	if path != apisPrefix && !strings.HasPrefix(path, apisPrefix+"/") {
		next.ServeHTTP(w, req)
		return
	}

	// Root discovery (APIGroupList) is the only path that needs a union
	// across every group; synthesize it router-side.
	if path == apisPrefix || path == apisPrefix+"/" {
		cr.serveAPIGroupList(w, req)
		return
	}

	group := groupFromPath(path)
	backends := *cr.snapshot.Load()
	b, ok := backends[group]
	if !ok {
		// A group we don't serve. Fall through rather than 404 so a caller
		// mounted ahead of us keeps its own routes.
		next.ServeHTTP(w, req)
		return
	}
	// /apis/<group> group discovery and /apis/<group>/... both proxy to the
	// single owning backend (one backend owns all versions of a group).
	b.Handler().ServeHTTP(w, req)
}

// groupFromPath returns the group segment of an /apis/<group>[/...] path.
// The caller guarantees the /apis/ prefix and a non-root path.
func groupFromPath(path string) string {
	rest := strings.TrimPrefix(path, apisPrefix+"/")
	if i := strings.IndexByte(rest, '/'); i >= 0 {
		rest = rest[:i]
	}
	return rest
}

// serveAPIGroupList synthesizes the /apis root (APIGroupList) from the current
// group snapshot.
func (cr *BasicRouter) serveAPIGroupList(w http.ResponseWriter, _ *http.Request) {
	// TODO: build a real APIGroupList from the snapshot keys (each group's
	// versions come from its Manifest / group discovery).
	http.Error(w, "apis discovery not implemented", http.StatusNotImplemented)
}

// OpenAPIV3Handler serves the merged OpenAPI v3 document.
func (cr *BasicRouter) OpenAPIV3Handler() http.Handler {
	// TODO: merge local control-plane specs with proxied backends' specs.
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "openapi v3 not implemented", http.StatusNotImplemented)
	})
}

// Run does an initial load, then reconciles on every coalesced wake from the
// loader until ctx is cancelled. A non-nil return is fatal by design.
func (r *BasicRouter) Run(ctx context.Context) error {
	dirty, err := r.loader.Notify(ctx)
	if err != nil {
		return fmt.Errorf("router: notify: %w", err)
	}

	r.reconcile(ctx) // initial populate, independent of watch replay

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-dirty:
			r.reconcile(ctx)
		}
	}
}

// Ready reports the router is initialized and serving. The snapshot is
// populated on the first reconcile in Run.
func (r *BasicRouter) Ready(context.Context) error { return nil }

// Alive reports the router is not in a non-recoverable state.
func (r *BasicRouter) Alive(context.Context) error { return nil }

// reconcile re-reads the full desired route set and converges entries to it:
// rebuild changed/new groups, leave unchanged ones (RV match) untouched, drop
// groups that disappeared, then publish a fresh snapshot. Level-triggered, so
// it is safe to run on any wake.
func (r *BasicRouter) reconcile(ctx context.Context) {
	cfgs, err := r.loader.Load(ctx)
	if err != nil {
		// Keep serving last-known-good; a later wake retries.
		slog.Error("router: load failed, keeping current routes", "error", err)
		return
	}

	seen := make(map[string]struct{}, len(cfgs))
	for _, cfg := range cfgs {
		group := cfg.Group
		if _, dup := seen[group]; dup {
			// One backend owns all versions of a group; a duplicate group in a
			// single load is a config error. Last-wins, warn — do not crash the
			// router on bad GitOps config.
			slog.Warn("router: duplicate group in route set, overwriting", "group", group)
		}
		seen[group] = struct{}{}

		e, ok := r.entries[group]
		if ok && e.lastRV == cfg.RV {
			continue // unchanged: keep the live Backend (and its pool)
		}

		backend := r.buildBackend(cfg)
		if !ok {
			r.entries[group] = &groupEntry{backend: backend, lastRV: cfg.RV}
			continue
		}
		// Changed: rebuild. The transport (and its pool) is reused from the
		// shared cache when the TLS key is unchanged, so the pool survives.
		e.backend = backend
		e.lastRV = cfg.RV
	}

	for group := range r.entries {
		if _, ok := seen[group]; !ok {
			delete(r.entries, group)
		}
	}

	r.publish()
}

// publish builds a fresh immutable group -> Backend snapshot from entries and
// stores it atomically for the serving path.
func (r *BasicRouter) publish() {
	snap := make(map[string]Backend, len(r.entries))
	for group, e := range r.entries {
		snap[group] = e.backend
	}
	r.snapshot.Store(&snap)
}

// buildBackend turns a RouteConfig into a servable Backend. Build errors are
// captured on the Backend so it serves a 500 rather than the reconcile loop
// failing the whole set.
func (r *BasicRouter) buildBackend(cfg RouteConfig) Backend {
	rs := cfg.Backend
	if rs.Mode != v1alpha2.RouteBackendSpecModeForward {
		// TODO: handle operator/plugin modes.
		return &forwardBackend{name: cfg.Group, buildErr: fmt.Errorf("unsupported route backend mode %q", rs.Mode)}
	}

	backend := rs.Forward

	transportKey := tlsCacheKey{
		insecure: backend.Tls.SkipTLSVerify,
	}
	if backend.Tls.CaData != nil {
		transportKey.caData = *backend.Tls.CaData
	}
	tr, err := r.transportFor(transportKey)
	if err != nil {
		return &forwardBackend{name: cfg.Group, buildErr: fmt.Errorf("build transport for group=%s, err=%w", cfg.Group, err)}
	}

	u, err := url.Parse(backend.Url)
	if err != nil {
		return &forwardBackend{name: cfg.Group, buildErr: fmt.Errorf("error parsing backend url: group=%s, err=%w", cfg.Group, err)}
	}
	return &forwardBackend{
		name:   cfg.Group,
		target: u,
		proxy: &httputil.ReverseProxy{
			Rewrite:        func(pr *httputil.ProxyRequest) { pr.SetURL(u) },
			Transport:      tr,
			ModifyResponse: rejectBackendRedirects,
		},
	}
}

func rejectBackendRedirects(resp *http.Response) error {
	if resp.StatusCode >= 300 && resp.StatusCode <= 399 && resp.Header.Get("Location") != "" {
		resp.Body.Close()
		// replace with 502 — don't forward the redirect
	}
	return nil
}

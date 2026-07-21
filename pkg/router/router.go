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

	"github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"k8s.io/client-go/transport"
)

type backendRecord struct {
	handler *backendHandler
	// lastRV is the RouteConfig fingerprint last applied for this group (the
	// backend-RV, or backend-RV-manifest-RV for operator/plugin modes). Used to
	// skip rebuilding a backend whose config has not changed, preserving its
	// connection pool across reconciles.
	lastRV string
}

// there won't be a cloud apps router in enterprise
// can be in OSS right now, RoutesLoader stays in enterprise in cloud
type BasicRouter struct {
	loader RoutesLoader

	dialer     *transport.DialHolder
	transports map[tlsCacheKey]*http.Transport

	// mux is the stable dispatcher. It is registered once per group and swaps its
	// routing snapshot internally, so serving (Handler) and reconcile never race.
	mux *PathMux

	// backendRecords are the currently registered handlers, keyed by the mux
	// prefix (/apis/<group>/). Touched only by reconcile (single goroutine).
	backendRecords map[string]*backendRecord
}

func NewRouter(loader RoutesLoader) *BasicRouter {
	return &BasicRouter{
		loader:         loader,
		mux:            NewPathMux("cloud-apps"),
		transports:     map[tlsCacheKey]*http.Transport{},
		backendRecords: map[string]*backendRecord{},
	}
}

// transportFor returns a transport for the given TLS settings, building and
// caching one on first use. Called only from reconcile (single goroutine), so
// the transports map needs no lock. Backends sharing a tlsCacheKey share a
// transport, so their connection pools are shared too.
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

// Handler serves the reverse-proxy tree. server.go mounts it at /apis; the
// PathMux routes by group prefix from there.
func (cr *BasicRouter) Handler(next http.Handler) http.Handler {
	// NOTE: when implementing OpenAPIV3Handler(), we need to support
	// serverAddrressByClientCIDRs in /apis to allow local in-network clients to be able to connect directly as desired
	//
	// 2 routes to explicity handle: /apis (discovery) and /openapi/v3
	return cr.mux
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

// reconcile re-reads the full desired route set and converges backendRecords to
// it: upsert changed/new groups, leave unchanged ones (RV match) untouched, drop
// groups that disappeared. Level-triggered, so it is safe to run on any wake.
func (r *BasicRouter) reconcile(ctx context.Context) {
	cfgs, err := r.loader.Load(ctx)
	if err != nil {
		// Keep serving last-known-good; a later wake retries.
		slog.Error("router: load failed, keeping current routes", "error", err)
		return
	}

	seen := make(map[string]struct{}, len(cfgs))
	for _, cfg := range cfgs {
		prefix := apisPrefix(cfg.Group)
		seen[prefix] = struct{}{}

		rec, ok := r.backendRecords[prefix]
		if ok && rec.lastRV == cfg.RV {
			continue // unchanged: preserve handler and its connection pool
		}

		newCfg := r.buildBackendConfig(cfg)
		if !ok {
			// New group: register a stable handler once. Later config changes
			// swap cfg in place rather than re-registering.
			rec = &backendRecord{handler: &backendHandler{name: cfg.Group}}
			rec.handler.cfg.Store(newCfg)
			r.backendRecords[prefix] = rec
			r.mux.HandlePrefix(prefix, rec.handler)
		} else {
			rec.handler.cfg.Store(newCfg) // atomic swap; pool survives
		}
		rec.lastRV = cfg.RV
	}

	// Drop groups no longer present.
	for prefix := range r.backendRecords {
		if _, ok := seen[prefix]; ok {
			continue
		}
		r.mux.Unregister(prefix)
		delete(r.backendRecords, prefix)
	}
}

// buildBackendConfig turns a RouteConfig into a servable backendConfig. Build
// errors are captured in buildErr so the handler serves a 500 rather than the
// reconcile loop failing the whole set.
func (r *BasicRouter) buildBackendConfig(cfg *RouteConfig) *backendConfig {
	rs := cfg.Backend
	if rs.Mode != v1alpha2.RouteBackendSpecModeForward {
		// TODO: handle operator/plugin modes.
		return &backendConfig{buildErr: fmt.Errorf("unsupported route backend mode %q", rs.Mode)}
	}

	backend := rs.Forward

	tr, err := r.transportFor(tlsCacheKey{
		caData:   *backend.Tls.CaData,
		insecure: backend.Tls.SkipTLSVerify,
	})
	if err != nil {
		return &backendConfig{buildErr: fmt.Errorf("build transport for group=%s, err=%w", cfg.Group, err)}
	}

	u, err := url.Parse(cfg.Backend.Forward.Url)
	if err != nil {
		return &backendConfig{buildErr: fmt.Errorf("error parsing backend url: group=%s, err=%w", cfg.Group, err)}
	}
	return &backendConfig{
		target: u,
		proxy: &httputil.ReverseProxy{
			Rewrite:        func(pr *httputil.ProxyRequest) { pr.SetURL(u) },
			Transport:      tr,
			ModifyResponse: rejectBackendRedirects,
		},
	}
}

// apisPrefix maps an API group to its mux prefix. Trailing slash is required by
// PathMux.HandlePrefix and gives a path-boundary match (/apis/<group>/...).
func apisPrefix(group string) string {
	return "/apis/" + group + "/"
}

func rejectBackendRedirects(resp *http.Response) error {
	if resp.StatusCode >= 300 && resp.StatusCode <= 399 && resp.Header.Get("Location") != "" {
		resp.Body.Close()
		// replace with 502 — don't forward the redirect
	}
	return nil
}

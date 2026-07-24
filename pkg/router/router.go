package router

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync/atomic"
)

const apisPrefix = "/apis"

// handlerEntry is the router's persistent, reconcile-only record for one group:
// the live Backend plus lastRV, the RouteConfig fingerprint last applied. lastRV
// lets reconcile skip rebuilding a group whose config has not changed. Touched
// only by reconcile (single goroutine), so it needs no lock.
type handlerEntry struct {
	handler http.Handler
	lastRV  string
}

type phase int

const (
	starting phase = iota // Run launched, first reconcile not done
	serving               // first reconcile done, loop running
	stopped               // clean exit (Run ctx cancelled)
	crashed               // loop exited/panicked unexpectedly
)

type routerState struct {
	phase phase
	err   error // last reconcile error while serving, or the panic on crash
}

// there won't be a cloud apps router in enterprise
// can be in OSS right now, RoutesLoader stays in enterprise in cloud
type GrafanaRouter struct {
	state atomic.Pointer[routerState]

	loader RoutesLoader

	// entries is the desired-state map, keyed by group. Owned by reconcile
	// (single goroutine); never read from the serving path.
	entries map[string]*handlerEntry

	// snapshot is the immutable group -> Backend map used to serve requests.
	// reconcile rebuilds and atomically stores it; serving loads it.
	snapshot atomic.Pointer[map[string]http.Handler]
}

func NewGrafanaRouter(loader RoutesLoader) *GrafanaRouter {
	r := &GrafanaRouter{
		loader:  loader,
		entries: map[string]*handlerEntry{},
	}
	empty := map[string]http.Handler{}
	r.snapshot.Store(&empty)
	return r
}

// HandleFunc serves the reverse-proxy tree by group, falling through to next for
// anything the router does not own. server.go mounts it at /apis. It is itself
// the serving function (http.HandlerFunc shape plus a next), so a caller wraps it
// as http.HandlerFunc(func(w, r) { router.HandleFunc(w, r, next) }).
//
// NOTE: when implementing OpenAPIV3Handler(), we need to support
// serverAddressByClientCIDRs in /apis to allow local in-network clients to
// connect directly as desired.
func (cr *GrafanaRouter) HandleFunc(w http.ResponseWriter, req *http.Request, next http.Handler) {
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
	handlers := *cr.snapshot.Load()
	h, ok := handlers[group]
	if !ok {
		// A group we don't serve. Fall through rather than 404 so a caller
		// mounted ahead of us keeps its own routes.
		next.ServeHTTP(w, req)
		return
	}
	// /apis/<group> group discovery and /apis/<group>/... both proxy to the
	// single owning backend (one backend owns all versions of a group).
	h.ServeHTTP(w, req)
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
func (cr *GrafanaRouter) serveAPIGroupList(w http.ResponseWriter, _ *http.Request) {
	// TODO: build a real APIGroupList from the snapshot keys (each group's
	// versions come from its Manifest / group discovery).
	http.Error(w, "apis discovery not implemented", http.StatusNotImplemented)
}

// OpenAPIV3Handler serves the merged OpenAPI v3 document.
func (cr *GrafanaRouter) OpenAPIV3Handler() http.Handler {
	// TODO: merge local control-plane specs with proxied backends' specs.
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "openapi v3 not implemented", http.StatusNotImplemented)
	})
}

// Run does an initial load, then reconciles on every coalesced wake from the
// loader until ctx is cancelled.
func (r *GrafanaRouter) Run(ctx context.Context) error {
	r.state.Store(&routerState{phase: starting})
	dirty, err := r.loader.Notify(ctx)
	if err != nil {
		return fmt.Errorf("router: notify: %w", err)
	}

	go func() {
		defer func() {
			if p := recover(); p != nil {
				r.state.Store(&routerState{phase: crashed, err: fmt.Errorf("panic: %v", p)})
			}
		}()

		lastErr := r.reconcile(ctx)
		r.state.Store(&routerState{phase: serving, err: lastErr})

		for {
			select {
			case <-ctx.Done():
				r.state.Store(&routerState{phase: stopped})
				return
			case <-dirty:
				r.state.Store(&routerState{phase: serving, err: r.reconcile(ctx)})
			}
		}
	}()
	return nil
}

// Ready reports the router is initialized and serving. The snapshot is
// populated on the first reconcile in Run.
func (r *GrafanaRouter) Ready(context.Context) error {
	s := r.state.Load()
	switch {
	case s == nil || s.phase == starting:
		return fmt.Errorf("router: initial reconcile not complete")
	case s.phase == serving && s.err != nil:
		return fmt.Errorf("router: last reconcile failed: %w", s.err)
	case s.phase == serving:
		return nil
	default: // stopped / crashed
		return fmt.Errorf("router: not serving (phase %d)", s.phase)
	}
}

// Alive reports the router is not in a non-recoverable state. Only a crashed
// reconcile loop (unexpected exit or panic) is unrecoverable; a restart fixes
// it. starting/serving/stopped are all expected or transient.
func (r *GrafanaRouter) Alive(context.Context) error {
	if s := r.state.Load(); s != nil && s.phase == crashed {
		return fmt.Errorf("router: reconcile loop crashed: %w", s.err)
	}
	return nil
}

// reconcile re-reads the full desired route set and converges entries to it:
// rebuild changed/new groups, leave unchanged ones (RV match) untouched, drop
// groups that disappeared, then publish a fresh snapshot. Level-triggered, so
// it is safe to run on any wake.
func (r *GrafanaRouter) reconcile(ctx context.Context) error {
	backends, err := r.loader.Load(ctx)
	if err != nil {
		// Keep serving last-known-good; a later wake retries.
		return fmt.Errorf("router: load failed, keeping current routes: %w", err)
	}

	var errs []error
	seen := make(map[string]struct{}, len(backends))
	for _, b := range backends {
		group := b.Group()
		if _, dup := seen[group]; dup {
			// One backend owns all versions of a group; a duplicate group in a
			// single load is a config error. Last-wins, warn — do not crash the
			// router on bad GitOps config.
			slog.Warn("router: duplicate group in route set, overwriting", "group", group)
		}
		seen[group] = struct{}{}

		e, ok := r.entries[group]
		if ok && e.lastRV == b.RV() {
			continue // unchanged: keep the live Backend (and its pool)
		}

		handler, err := b.Load(ctx)
		if err != nil {
			// Load failed: keep last-known-good for this group (leave the
			// existing entry, if any, untouched) and don't publish a nil
			// handler. lastRV is not advanced, so a later wake retries.
			errs = append(errs, fmt.Errorf("router: backend load failed for group %q, keeping current route: %w", group, err))
			continue
		}

		if !ok {
			// New group: create the entry.
			r.entries[group] = &handlerEntry{handler: handler, lastRV: b.RV()}
			continue
		}
		// Changed: swap the handler in place. The transport (and its pool) is
		// reused from the shared cache when the TLS key is unchanged, so the
		// pool survives.
		e.handler = handler
		e.lastRV = b.RV()
	}

	for group := range r.entries {
		if _, ok := seen[group]; !ok {
			delete(r.entries, group)
		}
	}

	r.publish()
	return errors.Join(errs...)
}

// publish builds a fresh immutable group -> Backend snapshot from entries and
// stores it atomically for the serving path.
func (r *GrafanaRouter) publish() {
	snap := make(map[string]http.Handler, len(r.entries))
	for group, e := range r.entries {
		snap[group] = e.handler
	}
	r.snapshot.Store(&snap)
}

func rejectBackendRedirects(resp *http.Response) error {
	if resp.StatusCode >= 300 && resp.StatusCode <= 399 && resp.Header.Get("Location") != "" {
		resp.Body.Close()
		// replace with 502 — don't forward the redirect
	}
	return nil
}

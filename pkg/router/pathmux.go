// Copyright 2016 The Kubernetes Authors.
// Licensed under the Apache License, Version 2.0.
//
// PathMux is a dependency-free port of k8s.io/apiserver/pkg/server/mux.PathRecorderMux.
// It keeps a persistent map of path->handler and rebuilds an immutable routing snapshot
// on every mutation, swapping it atomically. Handlers registered here survive rebuilds,
// so a route change does not recreate unrelated backends (and their connection pools).
//
// Trimmed vs the original: no klog tracing, no debug.Stack duplicate diagnostics, and no
// k8s apimachinery sets dependency.
package router

import (
	"log/slog"
	"maps"
	"net/http"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
)

// PathMux records registered paths and serves requests by exact match, then prefix,
// then a not-found handler. Safe for concurrent Handle/Unregister and ServeHTTP.
type PathMux struct {
	name string

	lock            sync.Mutex
	notFoundHandler http.Handler
	pathToHandler   map[string]http.Handler
	prefixToHandler map[string]http.Handler

	// mux holds the current immutable *pathHandler snapshot used to serve requests.
	mux atomic.Value

	// exposedPaths is the list of listed paths, for a discovery/index endpoint.
	exposedPaths []string
}

// pathHandler is an immutable routing snapshot: satisfies requests first by exact match,
// then by prefix (longest/most-specific first), then by notFoundHandler.
type pathHandler struct {
	pathToHandler   map[string]http.Handler
	prefixHandlers  []prefixHandler
	notFoundHandler http.Handler
}

type prefixHandler struct {
	prefix  string
	handler http.Handler
}

// NewPathMux creates a new PathMux.
func NewPathMux(name string) *PathMux {
	m := &PathMux{
		name:            name,
		pathToHandler:   map[string]http.Handler{},
		prefixToHandler: map[string]http.Handler{},
		exposedPaths:    []string{},
	}
	m.mux.Store(&pathHandler{notFoundHandler: http.NotFoundHandler()})
	return m
}

// ListedPaths returns the registered (listed) paths, sorted.
func (m *PathMux) ListedPaths() []string {
	m.lock.Lock()
	handledPaths := append([]string{}, m.exposedPaths...)
	m.lock.Unlock()

	sort.Strings(handledPaths)
	return handledPaths
}

// refreshMuxLocked builds a fresh routing snapshot from the current maps and stores it.
// Must be called while holding m.lock, otherwise the snapshot may be inconsistent.
func (m *PathMux) refreshMuxLocked() {
	newMux := &pathHandler{
		pathToHandler:   map[string]http.Handler{},
		prefixHandlers:  []prefixHandler{},
		notFoundHandler: http.NotFoundHandler(),
	}
	if m.notFoundHandler != nil {
		newMux.notFoundHandler = m.notFoundHandler
	}

	maps.Copy(newMux.pathToHandler, m.pathToHandler)

	keys := make([]string, 0, len(m.prefixToHandler))
	for prefix := range m.prefixToHandler {
		keys = append(keys, prefix)
	}
	sort.Sort(sort.Reverse(byPrefixPriority(keys)))
	for _, prefix := range keys {
		newMux.prefixHandlers = append(newMux.prefixHandlers, prefixHandler{
			prefix:  prefix,
			handler: m.prefixToHandler[prefix],
		})
	}

	m.mux.Store(newMux)
}

// NotFoundHandler sets the handler to use when no path matches.
func (m *PathMux) NotFoundHandler(notFoundHandler http.Handler) {
	m.lock.Lock()
	defer m.lock.Unlock()

	m.notFoundHandler = notFoundHandler
	m.refreshMuxLocked()
}

// Unregister removes a path (exact or prefix) from the mux.
func (m *PathMux) Unregister(path string) {
	m.lock.Lock()
	defer m.lock.Unlock()

	delete(m.pathToHandler, path)
	delete(m.prefixToHandler, path)
	for i := range m.exposedPaths {
		if m.exposedPaths[i] == path {
			m.exposedPaths = append(m.exposedPaths[:i], m.exposedPaths[i+1:]...)
			break
		}
	}

	m.refreshMuxLocked()
}

// Handle registers handler for an exact path. A duplicate registration overwrites the
// previous handler; unlike the k8s original this does not panic, since routes here are
// driven by dynamic (GitOps) config rather than static code.
func (m *PathMux) Handle(path string, handler http.Handler) {
	m.lock.Lock()
	defer m.lock.Unlock()

	if _, dup := m.pathToHandler[path]; dup {
		slog.Warn("PathMux: duplicate exact path registration, overwriting", "mux", m.name, "path", path)
	} else {
		m.exposedPaths = append(m.exposedPaths, path)
	}
	m.pathToHandler[path] = handler
	m.refreshMuxLocked()
}

// HandleFunc registers handler for an exact path.
func (m *PathMux) HandleFunc(path string, handler func(http.ResponseWriter, *http.Request)) {
	m.Handle(path, http.HandlerFunc(handler))
}

// HandlePrefix registers handler for everything under path. path must end in a slash.
func (m *PathMux) HandlePrefix(path string, handler http.Handler) {
	if !strings.HasSuffix(path, "/") {
		panic(m.name + ": HandlePrefix path must end in a trailing slash: " + path)
	}

	m.lock.Lock()
	defer m.lock.Unlock()

	if _, dup := m.prefixToHandler[path]; dup {
		slog.Warn("PathMux: duplicate prefix path registration, overwriting", "mux", m.name, "path", path)
	} else {
		m.exposedPaths = append(m.exposedPaths, path)
	}
	m.prefixToHandler[path] = handler
	m.refreshMuxLocked()
}

// ServeHTTP makes PathMux an http.Handler. Loads the current snapshot per request.
func (m *PathMux) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	m.mux.Load().(*pathHandler).ServeHTTP(w, r)
}

func (h *pathHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if exactHandler, ok := h.pathToHandler[r.URL.Path]; ok {
		exactHandler.ServeHTTP(w, r)
		return
	}

	for _, ph := range h.prefixHandlers {
		if strings.HasPrefix(r.URL.Path, ph.prefix) {
			ph.handler.ServeHTTP(w, r)
			return
		}
	}

	h.notFoundHandler.ServeHTTP(w, r)
}

// byPrefixPriority orders prefixes longest first, then lexically, so the most specific
// prefix is tested first (longest-prefix match).
//
// The k8s original (PathRecorderMux) sorts by slash count first, then length. Since
// HandlePrefix requires a trailing slash, any prefix that is a string-prefix of another
// must also have strictly fewer slashes, so length alone yields the same routing decision;
// the slash-count key is dropped here for readability.
type byPrefixPriority []string

func (s byPrefixPriority) Len() int      { return len(s) }
func (s byPrefixPriority) Swap(i, j int) { s[i], s[j] = s[j], s[i] }
func (s byPrefixPriority) Less(i, j int) bool {
	if len(s[i]) != len(s[j]) {
		return len(s[i]) < len(s[j])
	}
	return strings.Compare(s[i], s[j]) < 0
}

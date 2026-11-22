package router

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"

	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/endpoints/responsewriter"
)

const embeddedSource = "embedded"

// embeddedBaseURL is a placeholder: discovery requests go straight to the
// embedded API server's handler, never over the network.
const embeddedBaseURL = "http://embedded"

var errEmbeddedNotStarted = errors.New("router: the embedded API server has not started")

// embeddedUpstream is the embedded API server's handler, which the server sets
// once it has started (Service.SetUpstream).
type embeddedUpstream struct {
	handler atomic.Pointer[http.Handler]
}

func (u *embeddedUpstream) set(handler http.Handler) {
	u.handler.Store(&handler)
}

func (u *embeddedUpstream) get() http.Handler {
	if handler := u.handler.Load(); handler != nil {
		return *handler
	}
	return nil
}

// embeddedLoader serves the embedded API server's groups alongside base's, in
// middleware mode, where the router serves the whole /apis tree in its place.
// The server's groups don't change once it has started, so its discovery is
// read once, on the first Load after it starts. A group base also serves is
// base's: the router takes groups over from the embedded server.
type embeddedLoader struct {
	base     RoutesLoader
	upstream *embeddedUpstream

	mu       sync.Mutex
	embedded []Backend // nil until read
}

func newEmbeddedLoader(base RoutesLoader, upstream *embeddedUpstream) *embeddedLoader {
	return &embeddedLoader{base: base, upstream: upstream}
}

func (l *embeddedLoader) Notify(ctx context.Context) (<-chan struct{}, error) {
	return l.base.Notify(ctx)
}

func (l *embeddedLoader) Load(ctx context.Context) ([]Backend, error) {
	embedded, err := l.embeddedBackends(ctx)
	if err != nil {
		return nil, err
	}
	backends, err := l.base.Load(ctx)
	if err != nil {
		return nil, err
	}
	served := make(map[string]struct{}, len(backends))
	for _, b := range backends {
		served[b.Group().Name] = struct{}{}
	}
	all := make([]Backend, 0, len(embedded)+len(backends))
	for _, b := range embedded {
		if _, ok := served[b.Group().Name]; !ok {
			all = append(all, b)
		}
	}
	return append(all, backends...), nil
}

// embeddedBackends reads the embedded server's discovery the first time it
// succeeds. A failure isn't kept, so the reconcile that returns it retries.
func (l *embeddedLoader) embeddedBackends(ctx context.Context) ([]Backend, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.embedded != nil {
		return l.embedded, nil
	}
	handler := l.upstream.get()
	if handler == nil {
		return nil, errEmbeddedNotStarted
	}
	client := &http.Client{Transport: handlerTransport{handler}}
	// The embedded server authenticates the requester in the context; listing
	// its groups is the router's own request.
	discovered, err := discoverGroupResources(identity.WithServiceIdentityContext(ctx, 1), client, embeddedBaseURL)
	if err != nil {
		return nil, fmt.Errorf("router: reading the embedded API server's discovery: %w", err)
	}
	embedded := make([]Backend, 0, len(discovered))
	for _, d := range discovered {
		key, err := discoveredGroupKey(d)
		if err != nil {
			return nil, fmt.Errorf("router: embedded group %q: %w", d.group.Name, err)
		}
		embedded = append(embedded, &embeddedBackend{
			group:     d.group,
			discovery: d.discovery,
			key:       embeddedSource + ":" + key,
			handler:   embeddedHandler{handler},
		})
	}
	l.embedded = embedded
	return embedded, nil
}

// handlerTransport is an http.RoundTripper that calls an in-process handler.
type handlerTransport struct{ handler http.Handler }

func (t handlerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	return responsewriter.WrapHandler(t.handler)(req)
}

// embeddedBackend serves one of the embedded API server's groups through the
// server's own handler, in process.
type embeddedBackend struct {
	group     metav1.APIGroup
	discovery *apidiscoveryv2.APIGroupDiscovery
	key       string
	handler   embeddedHandler
}

func (b *embeddedBackend) Group() metav1.APIGroup { return b.group }
func (b *embeddedBackend) Key() string            { return b.key }
func (b *embeddedBackend) Source() string         { return embeddedSource }

func (b *embeddedBackend) Load(context.Context) (http.Handler, error) { return b.handler, nil }

// Discovery is the group's resources as the embedded server listed them, or
// false when it listed only versions.
func (b *embeddedBackend) Discovery() (apidiscoveryv2.APIGroupDiscovery, bool) {
	if b.discovery == nil {
		return apidiscoveryv2.APIGroupDiscovery{}, false
	}
	return *b.discovery, true
}

// embeddedHandler is the embedded API server's handler. It runs in this
// process, so a group breaker failing fast would protect nothing, while a
// transient 503 would block the whole group: it opts out of breaking.
type embeddedHandler struct{ http.Handler }

func (embeddedHandler) hasNoCircuitBreaker() {}

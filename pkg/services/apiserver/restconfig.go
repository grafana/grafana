package apiserver

import (
	"context"
	"errors"
	"net/http"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	clientrest "k8s.io/client-go/rest"
)

type RestConfigProvider interface {
	GetRestConfig(context.Context) (*clientrest.Config, error)
}

type RestConfigProviderFunc func(context.Context) (*clientrest.Config, error)

func (f RestConfigProviderFunc) GetRestConfig(ctx context.Context) (*clientrest.Config, error) {
	return f(ctx)
}

// WithoutRestConfig is a RestConfigProvider that always returns an error.
// This is intended for use in unit tests where the rest config is not needed.
var WithoutRestConfig = RestConfigProviderFunc(func(context.Context) (*clientrest.Config, error) {
	return nil, errors.New("rest config will not be available (unit test?)")
})

type DirectRestConfigProvider interface {
	// GetDirectRestConfig returns a k8s client configuration that will use the same
	// logged in user as the current request context.  This is useful when
	// creating clients that map legacy API handlers to k8s backed services
	GetDirectRestConfig(c *contextmodel.ReqContext) *clientrest.Config

	// This can be used to rewrite incoming requests to path now supported under /apis
	DirectlyServeHTTP(w http.ResponseWriter, r *http.Request)
}

func ProvideEventualRestConfigProvider() *eventualRestConfigProvider {
	return &eventualRestConfigProvider{
		ready: make(chan struct{}),
	}
}

var (
	_ RestConfigProvider       = (*eventualRestConfigProvider)(nil)
	_ DirectRestConfigProvider = (*eventualRestConfigProvider)(nil)
)

// eventualRestConfigProvider is a RestConfigProvider that will not return a rest config until the ready channel is closed.
// This exists to alleviate a circular dependency between the apiserver.server's dependencies and their dependencies wanting a rest config.
// Importantly, this is handled by wire as opposed to a mutable global.
type eventualRestConfigProvider struct {
	// When this channel is closed, we can start returning the rest config.
	ready chan struct{}
	cfg   interface {
		RestConfigProvider
		DirectRestConfigProvider
	}
}

func (e *eventualRestConfigProvider) GetRestConfig(ctx context.Context) (*clientrest.Config, error) {
	select {
	case <-e.ready:
		return e.cfg.GetRestConfig(ctx)
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (e *eventualRestConfigProvider) GetDirectRestConfig(c *contextmodel.ReqContext) *clientrest.Config {
	select {
	case <-e.ready:
		return e.cfg.GetDirectRestConfig(c)
	case <-c.Req.Context().Done():
		return nil
	}
}

func (e *eventualRestConfigProvider) DirectlyServeHTTP(w http.ResponseWriter, r *http.Request) {
	select {
	case <-e.ready:
		e.cfg.DirectlyServeHTTP(w, r)
	case <-r.Context().Done():
		// Do nothing: the request has been cancelled.
	}
}

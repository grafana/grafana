package apiserver

import (
	"context"
	"net/http"

	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/services/apiserver/restconfig"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

func ProvideEventualRestConfigProvider() *eventualRestConfigProvider {
	return &eventualRestConfigProvider{
		ready: make(chan struct{}),
	}
}

var (
	_ restconfig.RestConfigProvider       = (*eventualRestConfigProvider)(nil)
	_ restconfig.DirectRestConfigProvider = (*eventualRestConfigProvider)(nil)
)

// eventualRestConfigProvider is a RestConfigProvider that will not return a rest config until the ready channel is closed.
// This exists to alleviate a circular dependency between the apiserver.server's dependencies and their dependencies wanting a rest config.
// Importantly, this is handled by wire as opposed to a mutable global.
// NOTE: this implementation's GetRestConfig can't be used in (wire-based) Provide functions, or a function called by Provide functions. TODO: determine why that is. @charandas: in one such attempt, the GetRestConfig waits forever and Grafana doesn't start.
type eventualRestConfigProvider struct {
	// When this channel is closed, we can start returning the rest config.
	ready chan struct{}
	cfg   interface {
		restconfig.RestConfigProvider
		restconfig.DirectRestConfigProvider
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

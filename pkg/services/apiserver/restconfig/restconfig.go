package restconfig

import (
	"context"
	"net/http"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	clientrest "k8s.io/client-go/rest"
)

type DirectRestConfigProvider interface {
	// GetDirectRestConfig returns a k8s client configuration that will use the same
	// logged in user as the current request context.  This is useful when
	// creating clients that map legacy API handlers to k8s backed services
	GetDirectRestConfig(c *contextmodel.ReqContext) *clientrest.Config

	// This can be used to rewrite incoming requests to path now supported under /apis
	DirectlyServeHTTP(w http.ResponseWriter, r *http.Request)
}

type RestConfigProvider interface {
	// GetRestConfig returns a k8s client configuration that is used to provide connection info and auth for the loopback transport.
	// context is only available for tracing in this immediate function and is not to be confused with the context seen by any client verb actions that are invoked with the retrieved rest config.
	// - those client verb actions have the ability to specify their own context.
	GetRestConfig(context.Context) (*clientrest.Config, error)
}

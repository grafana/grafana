package apiserver

import (
	"context"
	"net/http"

	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/registry"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type Service interface {
	services.NamedService
	registry.BackgroundService
	registry.CanBeDisabled
}

type RestConfigProvider interface {
	GetRestConfig(context.Context) *clientrest.Config
}

type DirectRestConfigProvider interface {
	// GetDirectRestConfig returns a k8s client configuration that will use the same
	// logged in user as the current request context.  This is useful when
	// creating clients that map legacy API handlers to k8s backed services
	GetDirectRestConfig(c *contextmodel.ReqContext) *clientrest.Config

	// This can be used to rewrite incoming requests to path now supported under /apis
	DirectlyServeHTTP(w http.ResponseWriter, r *http.Request)
}

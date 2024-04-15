package datasource

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"k8s.io/apiserver/pkg/registry/rest"
)

type HTTPRequestHandlerFunc func(ctx context.Context, pluginCtx backend.PluginContext, responder rest.Responder) (http.Handler, error)

type PluginRequestHandlers struct {
	health   HTTPRequestHandlerFunc
	query    HTTPRequestHandlerFunc
	resource HTTPRequestHandlerFunc
}

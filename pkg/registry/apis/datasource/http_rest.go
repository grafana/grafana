package datasource

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

func (b *DataSourceAPIBuilder) httpHandlers() *HTTPHandlers {
	return NewHTTPHandlers(HTTPHandlerOptions{
		Group: b.GetGroupVersion().Group, PluginID: b.pluginJSON.ID, HandlerOrigin: b.cfg.HandlerOrigin,
		Client: b.client, PluginContext: b.getPluginContext, ContextProvider: b.contextProvider,
		Datasources: b.datasources, RequestValidator: b.dataSourceRequestValidator,
		EnableChunkedQueries: b.cfg.EnableChunkedQueryStreaming,
	})
}

// Only the apiserver adapter needs runtime.Object and its negotiated responder.
type restHTTPResponder struct{ rest.Responder }

func (r restHTTPResponder) Object(status int, value any) {
	r.Responder.Object(status, value.(runtime.Object))
}

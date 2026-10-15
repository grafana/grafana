package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// NewQueryDataFormatMiddleware creates a middleware that requests the JSON wire format for QueryData
// while the datasources.jsonQueryDataFormat toggle is on, and Arrow for plugins listed in arrowPlugins.
func NewQueryDataFormatMiddleware(arrowPlugins []string) backend.HandlerMiddleware {
	ids := make(map[string]struct{}, len(arrowPlugins))
	for _, id := range arrowPlugins {
		ids[id] = struct{}{}
	}
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &QueryDataFormatMiddleware{
			BaseHandler:  backend.NewBaseHandler(next),
			arrowPlugins: ids,
		}
	})
}

// QueryDataFormatMiddleware selects the data frame wire format for unary QueryData requests.
type QueryDataFormatMiddleware struct {
	backend.BaseHandler

	arrowPlugins map[string]struct{}
}

func (m *QueryDataFormatMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	format := grpcplugin.QueryDataFormatArrow
	if m.requestJSON(ctx, req.PluginContext.PluginID) {
		format = grpcplugin.QueryDataFormatJSON
	}
	return m.BaseHandler.QueryData(grpcplugin.WithQueryDataFormat(ctx, format), req)
}

// QueryChunkedData passes through unchanged. The chunked request carries its own format.
func (m *QueryDataFormatMiddleware) QueryChunkedData(ctx context.Context, req *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
	return m.BaseHandler.QueryChunkedData(ctx, req, w)
}

func (m *QueryDataFormatMiddleware) requestJSON(ctx context.Context, pluginID string) bool {
	if _, ok := m.arrowPlugins[pluginID]; ok {
		return false
	}
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagDatasourcesJsonQueryDataFormat, false, openfeature.TransactionContext(ctx))
}

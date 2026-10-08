package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// NewQueryDataFormatMiddleware creates a middleware that keeps the Arrow wire format for QueryData
// when the datasources.jsonQueryDataFormat toggle is off or the plugin is listed in arrowPlugins.
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
	if m.keepArrow(ctx, req.PluginContext.PluginID) {
		ctx = grpcplugin.WithQueryDataFormat(ctx, grpcplugin.QueryDataFormatArrow)
	}
	return m.BaseHandler.QueryData(ctx, req)
}

// QueryChunkedData passes through unchanged. The chunked request carries its own format.
func (m *QueryDataFormatMiddleware) QueryChunkedData(ctx context.Context, req *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
	return m.BaseHandler.QueryChunkedData(ctx, req, w)
}

func (m *QueryDataFormatMiddleware) keepArrow(ctx context.Context, pluginID string) bool {
	if _, ok := m.arrowPlugins[pluginID]; ok {
		return true
	}
	return !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagDatasourcesJsonQueryDataFormat, true, openfeature.TransactionContext(ctx))
}

package clientmiddleware

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/backendplugin/grpcplugin"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestQueryDataFormatMiddleware(t *testing.T) {
	tests := []struct {
		name         string
		toggle       bool
		arrowPlugins []string
		pluginID     string
		wantFormat   grpcplugin.QueryDataFormat
		wantSet      bool
	}{
		{
			name:     "toggle on leaves the client default in place",
			toggle:   true,
			pluginID: "prometheus",
		},
		{
			name:       "toggle off requests Arrow",
			toggle:     false,
			pluginID:   "prometheus",
			wantFormat: grpcplugin.QueryDataFormatArrow,
			wantSet:    true,
		},
		{
			name:         "listed plugin requests Arrow with the toggle on",
			toggle:       true,
			arrowPlugins: []string{"loki", "tempo"},
			pluginID:     "loki",
			wantFormat:   grpcplugin.QueryDataFormatArrow,
			wantSet:      true,
		},
		{
			name:         "unlisted plugin leaves the client default in place",
			toggle:       true,
			arrowPlugins: []string{"loki", "tempo"},
			pluginID:     "prometheus",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if tc.toggle {
				featuremgmt.WithEnabledFlags(t, featuremgmt.FlagDatasourcesJsonQueryDataFormat)
			} else {
				featuremgmt.WithDisabledFlags(t, featuremgmt.FlagDatasourcesJsonQueryDataFormat)
			}

			cdt := handlertest.NewHandlerMiddlewareTest(t,
				handlertest.WithMiddlewares(NewQueryDataFormatMiddleware(tc.arrowPlugins)),
			)
			req := &backend.QueryDataRequest{
				PluginContext: backend.PluginContext{PluginID: tc.pluginID},
			}
			_, err := cdt.MiddlewareHandler.QueryData(context.Background(), req)
			require.NoError(t, err)

			format, ok := grpcplugin.QueryDataFormatFromContext(cdt.QueryDataCtx)
			require.Equal(t, tc.wantSet, ok)
			require.Equal(t, tc.wantFormat, format)
		})
	}

	t.Run("chunked requests pass through untouched", func(t *testing.T) {
		featuremgmt.WithDisabledFlags(t, featuremgmt.FlagDatasourcesJsonQueryDataFormat)
		cdt := handlertest.NewHandlerMiddlewareTest(t,
			handlertest.WithMiddlewares(NewQueryDataFormatMiddleware([]string{"prometheus"})),
		)
		req := &backend.QueryChunkedDataRequest{
			PluginContext: backend.PluginContext{PluginID: "prometheus"},
			Format:        backend.DataFrameFormat_JSON,
		}
		err := cdt.MiddlewareHandler.QueryChunkedData(context.Background(), req, nopChunkedWriter{})
		require.NoError(t, err)

		_, ok := grpcplugin.QueryDataFormatFromContext(cdt.QueryChunkedDataCtx)
		require.False(t, ok)
		require.Equal(t, backend.DataFrameFormat_JSON, cdt.QueryChunkedDataReq.Format)
	})
}

package clientmiddleware

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins/pluginrequestmeta"
)

func TestStatusSourceMiddleware(t *testing.T) {
	someErr := errors.New("oops")

	for _, tc := range []struct {
		name string

		queryDataResponse *backend.QueryDataResponse

		expStatusSource pluginrequestmeta.StatusSource
	}{
		{
			name:              `no error should be "plugin" status source`,
			queryDataResponse: nil,
			expStatusSource:   pluginrequestmeta.StatusSourcePlugin,
		},
		{
			name: `single downstream error should be "downstream" status source`,
			queryDataResponse: &backend.QueryDataResponse{
				Responses: map[string]backend.DataResponse{
					"A": {Error: someErr, ErrorSource: backend.ErrorSourceDownstream},
				},
			},
			expStatusSource: pluginrequestmeta.StatusSourceDownstream,
		},
		{
			name: `single plugin error should be "plugin" status source`,
			queryDataResponse: &backend.QueryDataResponse{
				Responses: map[string]backend.DataResponse{
					"A": {Error: someErr, ErrorSource: backend.ErrorSourcePlugin},
				},
			},
			expStatusSource: pluginrequestmeta.StatusSourcePlugin,
		},
		{
			name: `multiple downstream errors should be "downstream" status source`,
			queryDataResponse: &backend.QueryDataResponse{
				Responses: map[string]backend.DataResponse{
					"A": {Error: someErr, ErrorSource: backend.ErrorSourceDownstream},
					"B": {Error: someErr, ErrorSource: backend.ErrorSourceDownstream},
				},
			},
			expStatusSource: pluginrequestmeta.StatusSourceDownstream,
		},
		{
			name: `single plugin error mixed with downstream errors should be "plugin" status source`,
			queryDataResponse: &backend.QueryDataResponse{
				Responses: map[string]backend.DataResponse{
					"A": {Error: someErr, ErrorSource: backend.ErrorSourceDownstream},
					"B": {Error: someErr, ErrorSource: backend.ErrorSourcePlugin},
					"C": {Error: someErr, ErrorSource: backend.ErrorSourceDownstream},
				},
			},
			expStatusSource: pluginrequestmeta.StatusSourcePlugin,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cdt := handlertest.NewHandlerMiddlewareTest(t,
				handlertest.WithMiddlewares(
					NewPluginRequestMetaMiddleware(),
					NewStatusSourceMiddleware(),
				),
			)
			cdt.TestHandler.QueryDataFunc = func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
				cdt.QueryDataCtx = ctx
				return tc.queryDataResponse, nil
			}

			_, _ = cdt.MiddlewareHandler.QueryData(context.Background(), &backend.QueryDataRequest{})

			ss := pluginrequestmeta.StatusSourceFromContext(cdt.QueryDataCtx)
			require.Equal(t, tc.expStatusSource, ss)
		})
	}
}

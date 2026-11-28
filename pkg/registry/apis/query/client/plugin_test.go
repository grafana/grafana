package client

import (
	"context"
	"encoding/json"
	"maps"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/dsquerierclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/clientmiddleware"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// recordingPlugin is the plugin at the end of the middleware chain. It
// records every request it gets.
type recordingPlugin struct {
	requests []*backend.QueryDataRequest
}

func (p *recordingPlugin) queryData(_ context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	p.requests = append(p.requests, req)

	rsp := backend.NewQueryDataResponse()
	for _, q := range req.Queries {
		rsp.Responses[q.RefID] = backend.DataResponse{Frames: data.Frames{data.NewFrame("",
			data.NewField("time", nil, []time.Time{time.Unix(1, 0)}),
			data.NewField("value", nil, []float64{2}),
		)}}
	}
	return rsp, nil
}

// TestExpressionHeadersReachPluginThroughQueryService runs expressions through
// the single-tenant query service client, the path behind
// /apis/query.grafana.app, and checks the headers the plugin gets.
func TestExpressionHeadersReachPluginThroughQueryService(t *testing.T) {
	ds := &datasources.DataSource{ID: 1, OrgID: 1, UID: "ds1", Type: "test"}
	signedInUser := &user.SignedInUser{OrgID: 1, Login: "admin", OrgRole: identity.RoleAdmin, Namespace: "default"}

	queries := []expr.Query{
		{
			RefID:      "A",
			DataSource: ds,
			JSON:       json.RawMessage(`{ "datasource": { "uid": "ds1", "type": "test" } }`),
			TimeRange:  expr.AbsoluteTimeRange{From: time.Unix(0, 0), To: time.Unix(60, 0)},
		},
		{
			RefID:      "B",
			DataSource: expr.DataSourceModel(),
			JSON:       json.RawMessage(`{ "datasource": { "uid": "__expr__", "type": "__expr__" }, "type": "math", "expression": "$A * 2" }`),
			TimeRange:  expr.AbsoluteTimeRange{From: time.Unix(0, 0), To: time.Unix(60, 0)},
		},
	}

	tests := []struct {
		name string
		// incoming are the headers on the HTTP request to the query API.
		incoming http.Header
		// exprHeaders are the headers the expression service gets with the request.
		exprHeaders map[string]string
		want        map[string]string
	}{
		{
			name: "API client that does not send the marker",
			want: map[string]string{"http_" + expr.HeaderFromExpression: "true"},
		},
		{
			name:        "incoming HTTP header wins over the expression header",
			incoming:    http.Header{"X-Dashboard-Uid": []string{"from-http-request"}},
			exprHeaders: map[string]string{"http_X-Dashboard-Uid": "from-expression"},
			want: map[string]string{
				"http_" + expr.HeaderFromExpression: "true",
				"http_X-Dashboard-Uid":              "from-http-request",
			},
		},
	}

	for _, tt := range tests {
		for _, grouped := range []bool{false, true} {
			name := tt.name
			if grouped {
				name += " grouped by data source"
			}
			t.Run(name, func(t *testing.T) {
				plugin := &recordingPlugin{}
				// The middleware that copies headers from the incoming HTTP request, as in production.
				pluginsClient, err := backend.HandlerFromMiddlewares(
					handlertest.Handler{QueryDataFunc: plugin.queryData},
					clientmiddleware.NewTracingHeaderMiddleware(),
				)
				require.NoError(t, err)

				ctx := identity.WithRequester(context.Background(), signedInUser)
				httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, "/apis/query.grafana.app/v0alpha1/namespaces/default/query", nil)
				require.NoError(t, err)
				httpReq.Header = tt.incoming.Clone()
				cdt := &handlertest.HandlerMiddlewareTest{T: t}
				clientmiddleware.WithReqContext(httpReq, signedInUser)(cdt)
				ctx = httpReq.Context()

				flags := []any{}
				if grouped {
					flags = append(flags, featuremgmt.FlagSseGroupByDatasource)
				}
				features := featuremgmt.WithFeatures(flags...)
				exprService := newExpressionService(t, ctx, ds, pluginsClient, features)

				_, err = exprService.TransformData(ctx, time.Now(), &expr.Request{
					OrgId:   1,
					User:    signedInUser,
					Headers: maps.Clone(tt.exprHeaders),
					Queries: queries,
				})
				require.NoError(t, err)

				require.Len(t, plugin.requests, 1)
				for k, v := range tt.want {
					require.Equal(t, v, plugin.requests[0].Headers[k], k)
				}
			})
		}
	}
}

// newExpressionService builds the expression service the way the query API
// does in single-tenant mode: every data source call goes through pluginClient.
func newExpressionService(t *testing.T, ctx context.Context, ds *datasources.DataSource, pluginsClient plugins.Client, features featuremgmt.FeatureToggles) *expr.Service {
	t.Helper()
	cfg := setting.NewCfg()
	pCtxProvider := plugincontext.ProvideService(
		cfg,
		localcache.ProvideService(),
		&pluginstore.FakePluginStore{PluginList: []pluginstore.Plugin{{JSONData: plugins.JSONData{ID: ds.Type}}}},
		&fakeDatasources.FakeCacheService{DataSources: []*datasources.DataSource{ds}},
		&fakeDatasources.FakeDataSourceService{DataSources: []*datasources.DataSource{ds}},
		&pluginsettings.FakePluginSettings{},
		pluginconfig.NewFakePluginRequestConfigProvider(),
	)

	provider := NewSingleTenantInstanceProvider(cfg, features, pluginsClient, pCtxProvider, actest.FakeAccessControl{ExpectedEvaluate: true})
	instance, err := provider.GetInstance(ctx, log.NewNopLogger(), nil)
	require.NoError(t, err)
	builder := dsquerierclient.NewQsDatasourceClientBuilderWithInstance(instance, ctx, log.NewNopLogger())

	return expr.ProvideService(&setting.Cfg{ExpressionsEnabled: true}, nil, nil, features, nil, tracing.InitializeTracerForTest(), builder)
}

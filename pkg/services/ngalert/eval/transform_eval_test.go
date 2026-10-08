package eval

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/dsquerierclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// queryDataClient answers data source queries from fixed responses; other plugin calls panic.
type queryDataClient struct {
	plugins.Client
	responses map[string]backend.DataResponse
}

func (c *queryDataClient) QueryData(_ context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()
	for _, q := range req.Queries {
		resp.Responses[q.RefID] = c.responses[q.RefID]
	}
	return resp, nil
}

// latencyTable is what the data source returns for query A: one row per request.
func latencyTable() *data.Frame {
	return data.NewFrame("",
		data.NewField("service", nil, []string{"api", "api", "worker", "idle"}),
		data.NewField("latency", nil, []*float64{new(100.0), new(260.0), new(40.0), nil}),
	)
}

// transformRuleCondition is an alert rule that groups query A by service with a transform
// expression, then alerts on services whose mean latency is above 100.
func transformRuleCondition(dsUID string) models.Condition {
	return models.Condition{
		Condition: "C",
		Data: []models.AlertQuery{
			{
				RefID:             "A",
				DatasourceUID:     dsUID,
				Model:             json.RawMessage(`{"refId": "A"}`),
				RelativeTimeRange: models.RelativeTimeRange{From: models.Duration(10 * time.Minute)},
			},
			{
				RefID:         "T",
				DatasourceUID: expr.DatasourceUID,
				Model: json.RawMessage(`{
					"refId": "T",
					"type": "transform",
					"format": "alerting",
					"inputs": ["A"],
					"transformations": [{"id": "groupBy", "options": {"fields": {
						"service": {"operation": "groupby", "aggregations": []},
						"latency": {"operation": "aggregate", "aggregations": ["mean"]}
					}}}]
				}`),
			},
			{
				RefID:         "C",
				DatasourceUID: expr.DatasourceUID,
				Model: json.RawMessage(`{
					"refId": "C",
					"type": "threshold",
					"expression": "T",
					"conditions": [{"evaluator": {"type": "gt", "params": [100]}}]
				}`),
			},
		},
	}
}

// evaluateTransformRule evaluates transformRuleCondition the way the scheduler does, with the
// real expression engine calling the sidecar at sidecarURL.
func evaluateTransformRule(t *testing.T, sidecarURL string) Results {
	t.Helper()
	ds := &datasources.DataSource{UID: "latency-ds", Type: "latency-test"}
	cache := &fakes.FakeCacheService{DataSources: []*datasources.DataSource{ds}}
	store := &pluginstore.FakePluginStore{PluginList: []pluginstore.Plugin{{JSONData: plugins.JSONData{ID: ds.Type, Backend: true}}}}

	cfg := setting.NewCfg()
	cfg.ExpressionsEnabled = true
	cfg.TransformSidecarURL = sidecarURL
	cfg.TransformSidecarTimeout = 5 * time.Second

	pCtxProvider := plugincontext.ProvideService(cfg, nil, store, cache, &fakes.FakeDataSourceService{}, nil, pluginconfig.NewFakePluginRequestConfigProvider())
	client := &queryDataClient{responses: map[string]backend.DataResponse{"A": {Frames: data.Frames{latencyTable()}}}}
	exprService := expr.ProvideService(cfg, client, pCtxProvider, featuremgmt.WithFeatures(), nil, tracing.InitializeTracerForTest(), dsquerierclient.NewNullQSDatasourceClientBuilder())

	factory := NewEvaluatorFactory(setting.UnifiedAlertingSettings{EvaluationTimeout: 10 * time.Second}, cache, exprService)
	evaluator, err := factory.Create(NewContext(context.Background(), &user.SignedInUser{}), transformRuleCondition(ds.UID))
	require.NoError(t, err)

	results, err := evaluator.Evaluate(context.Background(), time.Now())
	require.NoError(t, err)
	for _, r := range results {
		t.Logf("instance=%v state=%s error=%v evaluation=%q", r.Instance, r.State, r.Error, r.EvaluationString)
	}
	return results
}

func statesByService(results Results) map[string]State {
	states := map[string]State{}
	for _, r := range results {
		states[r.Instance["service"]] = r.State
	}
	return states
}

func TestTransformExpressionAlertRule(t *testing.T) {
	t.Run("alerts per group returned by the sidecar", func(t *testing.T) {
		grouped := data.NewFrame("",
			data.NewField("service", nil, []*string{new("api"), new("worker")}),
			data.NewField("latency (mean)", nil, []*float64{new(180.0), new(40.0)}),
		)
		sidecar := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			require.NoError(t, json.NewEncoder(w).Encode(map[string]any{"frames": []*data.Frame{grouped}}))
		}))
		t.Cleanup(sidecar.Close)

		results := evaluateTransformRule(t, sidecar.URL)

		require.Equal(t, map[string]State{"api": Alerting, "worker": Normal}, statesByService(results))
	})

	t.Run("is in the Error state when the sidecar is unreachable", func(t *testing.T) {
		sidecar := httptest.NewServer(http.NotFoundHandler())
		url := sidecar.URL
		sidecar.Close()

		results := evaluateTransformRule(t, url)

		require.Len(t, results, 1)
		require.Equal(t, Error, results[0].State)
		require.ErrorContains(t, results[0].Error, "calling transform sidecar")
	})
}

// TestTransformExpressionAlertRuleWithSidecar runs the same rule against a real sidecar:
//
//	node scripts/transform-sidecar/build.mjs && node scripts/transform-sidecar/dist/server.cjs
//	TRANSFORM_SIDECAR_URL=http://127.0.0.1:8095 go test ./pkg/services/ngalert/eval -run TestTransformExpressionAlertRuleWithSidecar
func TestTransformExpressionAlertRuleWithSidecar(t *testing.T) {
	url := os.Getenv("TRANSFORM_SIDECAR_URL")
	if url == "" {
		t.Skip("TRANSFORM_SIDECAR_URL is not set")
	}

	results := evaluateTransformRule(t, url)

	states := statesByService(results)
	require.Equal(t, Alerting, states["api"], "api mean latency is 180")
	require.Equal(t, Normal, states["worker"], "worker mean latency is 40")
	// idle has no latency values. The table-to-number conversion shared with SQL expressions reads
	// the null mean as NaN, and NaN > 100 is false, so the instance is Normal rather than NoData.
	require.Equal(t, Normal, states["idle"])
}

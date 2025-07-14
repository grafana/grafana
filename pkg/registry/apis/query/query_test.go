package query

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/query/clientapi"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
)

// func TestQueryRestConnectHandler(t *testing.T) {
// 	b := &QueryAPIBuilder{
// 		clientSupplier: mockClient{
// 			lastCalledWithHeaders: &map[string]string{},
// 		},
// 		tracer: tracing.InitializeTracerForTest(),
// 		parser: newQueryParser(expr.NewExpressionQueryReader(featuremgmt.WithFeatures()),
// 			&legacyDataSourceRetriever{}, tracing.InitializeTracerForTest(), nil),
// 		log: log.New("test"),
// 	}
// 	qr := newQueryREST(b)
// 	ctx := context.Background()
// 	mr := mockResponder{}

// 	handler, err := qr.Connect(ctx, "name", nil, mr)
// 	require.NoError(t, err)

// 	rr := httptest.NewRecorder()
// 	body := runtime.RawExtension{
// 		Raw: []byte(`{
// 			"queries": [
// 				{
// 					"datasource": {
// 					"type": "prometheus",
// 					"uid": "demo-prometheus"
// 					},
// 					"expr": "sum(go_gc_duration_seconds)",
// 					"range": false,
// 					"instant": true
// 				}
// 			],
// 			"from": "now-1h",
// 			"to": "now"}`),
// 	}
// 	req := httptest.NewRequest(http.MethodGet, "/some-path", bytes.NewReader(body.Raw))
// 	req.Header.Set(models.FromAlertHeaderName, "true")
// 	req.Header.Set(models.CacheSkipHeaderName, "true")
// 	req.Header.Set("X-Rule-Name", "name-1")
// 	req.Header.Set("X-Rule-Uid", "abc")
// 	req.Header.Set("X-Rule-Folder", "folder-1")
// 	req.Header.Set("X-Rule-Source", "grafana-ruler")
// 	req.Header.Set("X-Rule-Type", "type-1")
// 	req.Header.Set("X-Rule-Version", "version-1")
// 	req.Header.Set("X-Grafana-Org-Id", "1")
// 	req.Header.Set("Content-Type", "application/json")
// 	req.Header.Set("some-unexpected-header", "some-value")
// 	handler.ServeHTTP(rr, req)

// 	require.Equal(t, map[string]string{
// 		models.FromAlertHeaderName: "true",
// 		models.CacheSkipHeaderName: "true",
// 		"X-Rule-Name":              "name-1",
// 		"X-Rule-Uid":               "abc",
// 		"X-Rule-Folder":            "folder-1",
// 		"X-Rule-Source":            "grafana-ruler",
// 		"X-Rule-Type":              "type-1",
// 		"X-Rule-Version":           "version-1",
// 		"X-Grafana-Org-Id":         "1",
// 	}, *b.clientSupplier.(mockClient).lastCalledWithHeaders)
// }

func TestExprOrdering(t *testing.T) {
	builder := &QueryAPIBuilder{
		parser: newQueryParser(expr.NewExpressionQueryReader(featuremgmt.WithFeatures()),
			&legacyDataSourceRetriever{}, tracing.InitializeTracerForTest(), nil),
		converter: &expr.ResultConverter{
			Features: featuremgmt.WithFeatures(),
			Tracer:   tracing.InitializeTracerForTest(),
		},
		clientSupplier: mockClientSupplier{
			//lastCalledWithHeaders: &map[string]string{},
		},
		tracer: tracing.InitializeTracerForTest(),
		log:    log.New("test"),
	}
	raw := []byte(`{
			"queries": [
				{
					"refId": "C",
					"datasource": {
					"type": "__expr__",
					"uid": "__expr__"
					},
					"type": "sql",
					"expression": "SELECT * FROM A"
				},
				{
				"refId": "B",
				"hide": true,
					"datasource": {
					"type": "testdata",
					"uid": "local-test"
					}
				},
				{
				"refId": "A",
				"hide": true,
					"datasource": {
					"type": "testdata",
					"uid": "local-test"
					}
				}
			],
			"from": "now-1h",
			"to": "now"}`)

	req := httptest.NewRequest(http.MethodGet, "/some-path", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")

	responder := newResponderWrapper(nil,
		func(statusCode *int, obj runtime.Object) {
		},

		func(err error) {

		})

	r := &query.QueryDataRequest{}
	err := web.Bind(req, r)
	require.NoError(t, err)

	qdr, err := handleQuery(context.Background(), *r, *builder, req, *responder)
	require.NoError(t, err)
	t.Log(qdr)
}

type mockResponder struct {
}

// Object writes the provided object to the response. Invoking this method multiple times is undefined.
func (m mockResponder) Object(statusCode int, obj runtime.Object) {
}

// Error writes the provided error to the response. This method may only be invoked once.
func (m mockResponder) Error(err error) {
}

type mockClientSupplier struct {
}

func (m mockClientSupplier) GetDataSourceClient(ctx context.Context, ref data.DataSourceRef, headers map[string]string, instanceConfig clientapi.InstanceConfigurationSettings) (clientapi.QueryDataClient, error) {
	mclient := mockClient{}
	return mclient, nil
}

func (m mockClientSupplier) GetInstanceConfigurationSettings(ctx context.Context) (clientapi.InstanceConfigurationSettings, error) {
	return clientapi.InstanceConfigurationSettings{
		ExpressionsEnabled: true,
		FeatureToggles:     featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions),
	}, nil
}

type mockClient struct {
	lastCalledWithHeaders *map[string]string
}

func (m mockClient) QueryData(ctx context.Context, req data.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return nil, fmt.Errorf("mock error")
}

func (m mockClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return nil
}

func (m mockClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return nil, nil
}

func (m mockClient) GetInstanceConfigurationSettings(ctx context.Context) (clientapi.InstanceConfigurationSettings, error) {
	return clientapi.InstanceConfigurationSettings{
		ExpressionsEnabled: true,
		FeatureToggles:     featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions),
	}, nil
}

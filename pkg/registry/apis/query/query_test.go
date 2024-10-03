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
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestQueryRestConnectHandler(t *testing.T) {
	b := &QueryAPIBuilder{
		client: mockClient{
			lastCalledWithHeaders: &map[string]string{},
		},
		tracer: tracing.InitializeTracerForTest(),
		parser: newQueryParser(expr.NewExpressionQueryReader(featuremgmt.WithFeatures()),
			&legacyDataSourceRetriever{}, tracing.InitializeTracerForTest()),
		log: log.New("test"),
	}
	qr := newQueryREST(b)
	ctx := context.Background()
	mr := mockResponder{}

	handler, err := qr.Connect(ctx, "name", nil, mr)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	body := runtime.RawExtension{
		Raw: []byte(`{
			"queries": [
				{
					"datasource": {
					"type": "prometheus",
					"uid": "demo-prometheus"
					},
					"expr": "sum(go_gc_duration_seconds)",
					"range": false,
					"instant": true
				}
			],
			"from": "now-1h",
			"to": "now"}`),
	}
	req := httptest.NewRequest(http.MethodGet, "/some-path", bytes.NewReader(body.Raw))
	req.Header.Set(models.FromAlertHeaderName, "true")
	req.Header.Set(models.CacheSkipHeaderName, "true")
	req.Header.Set("X-Rule-Uid", "abc")
	req.Header.Set("X-Rule-Folder", "folder-1")
	req.Header.Set("X-Rule-Source", "grafana-ruler")
	req.Header.Set("X-Grafana-Org-Id", "1")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("some-unexpected-header", "some-value")
	handler.ServeHTTP(rr, req)

	require.Equal(t, map[string]string{
		models.FromAlertHeaderName: "true",
		models.CacheSkipHeaderName: "true",
		"X-Rule-Uid":               "abc",
		"X-Rule-Folder":            "folder-1",
		"X-Rule-Source":            "grafana-ruler",
		"X-Grafana-Org-Id":         "1",
	}, *b.client.(mockClient).lastCalledWithHeaders)
}

type mockResponder struct {
}

// Object writes the provided object to the response. Invoking this method multiple times is undefined.
func (m mockResponder) Object(statusCode int, obj runtime.Object) {
}

// Error writes the provided error to the response. This method may only be invoked once.
func (m mockResponder) Error(err error) {
}

type mockClient struct {
	lastCalledWithHeaders *map[string]string
}

func (m mockClient) GetDataSourceClient(ctx context.Context, ref data.DataSourceRef, headers map[string]string) (data.QueryDataClient, error) {
	*m.lastCalledWithHeaders = headers

	return nil, fmt.Errorf("mock error")
}

func (m mockClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return nil, fmt.Errorf("mock error")
}

func (m mockClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return nil
}

func (m mockClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return nil, nil
}

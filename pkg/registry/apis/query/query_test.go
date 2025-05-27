package query

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	frameData "github.com/grafana/grafana-plugin-sdk-go/data"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/query/clientapi"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestQueryRestConnectHandler(t *testing.T) {
	b := &QueryAPIBuilder{
		clientSupplier: mockClient{
			lastCalledWithHeaders: &map[string]string{},
		},
		tracer: tracing.InitializeTracerForTest(),
		parser: newQueryParser(expr.NewExpressionQueryReader(featuremgmt.WithFeatures()),
			&legacyDataSourceRetriever{}, tracing.InitializeTracerForTest(), nil),
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
	req.Header.Set("X-Rule-Name", "name-1")
	req.Header.Set("X-Rule-Uid", "abc")
	req.Header.Set("X-Rule-Folder", "folder-1")
	req.Header.Set("X-Rule-Source", "grafana-ruler")
	req.Header.Set("X-Rule-Type", "type-1")
	req.Header.Set("X-Rule-Version", "version-1")
	req.Header.Set("X-Grafana-Org-Id", "1")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("some-unexpected-header", "some-value")
	handler.ServeHTTP(rr, req)

	require.Equal(t, map[string]string{
		models.FromAlertHeaderName: "true",
		models.CacheSkipHeaderName: "true",
		"X-Rule-Name":              "name-1",
		"X-Rule-Uid":               "abc",
		"X-Rule-Folder":            "folder-1",
		"X-Rule-Source":            "grafana-ruler",
		"X-Rule-Type":              "type-1",
		"X-Rule-Version":           "version-1",
		"X-Grafana-Org-Id":         "1",
	}, *b.clientSupplier.(mockClient).lastCalledWithHeaders)
}

func TestInstantQueryFromAlerting(t *testing.T) {
	builder := &QueryAPIBuilder{
		converter: &expr.ResultConverter{
			Features: featuremgmt.WithFeatures(),
			Tracer:   tracing.InitializeTracerForTest(),
		},
	}

	dq := data.DataQuery{}
	dq.RefID = "A"

	dr := datasourceRequest{
		Headers: map[string]string{
			models.FromAlertHeaderName: "true",
		},
		Request: &data.QueryDataRequest{
			Queries: []data.DataQuery{
				dq,
			},
		},
	}

	fakeFrame := frameData.NewFrame(
		"A",
		frameData.NewField("Time", nil, []time.Time{time.Now()}),
		frameData.NewField("Value", nil, []int64{42}),
	)
	fakeFrame.Meta = &frameData.FrameMeta{TypeVersion: frameData.FrameTypeVersion{0, 1}, Type: "numeric-multi"}

	inputQDR := &backend.QueryDataResponse{
		Responses: map[string]backend.DataResponse{
			"A": {
				Frames: frameData.Frames{
					fakeFrame,
				},
			},
		},
	}

	request := parsedRequestInfo{
		Requests: []datasourceRequest{
			dr,
		},
	}

	result, err := builder.convertQueryFromAlerting(context.Background(), dr, inputQDR)
	require.NoError(t, err)

	require.True(t, isSingleAlertQuery(request), "Expected a valid alert query with a single query to return true")
	require.NotNil(t, result)
	require.Equal(t, 1, len(result.Responses["A"].Frames[0].Fields), "Expected a single field not Time and Value")
	require.Equal(t, "Value", result.Responses["A"].Frames[0].Fields[0].Name, "Expected the single field to be Value")
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

func (m mockClient) GetDataSourceClient(ctx context.Context, ref data.DataSourceRef, headers map[string]string) (clientapi.QueryDataClient, error) {
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

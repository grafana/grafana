package query

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	dataapi "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	queryapi "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/query/clientapi"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestSinglePromQuery(t *testing.T) {
	builder := &QueryAPIBuilder{
		parser: newQueryParser(expr.NewExpressionQueryReader(featuremgmt.WithFeatures()),
			&legacyDataSourceRetriever{}, tracing.InitializeTracerForTest(), nil),
		converter: &expr.ResultConverter{
			Features: featuremgmt.WithFeatures(),
			Tracer:   tracing.InitializeTracerForTest(),
		},
		clientSupplier: mockClientSupplier{},
		tracer:         tracing.InitializeTracerForTest(),
		log:            log.New("test"),
	}
	raw := []byte(`{
    "queries": [
      {
        "datasource": {
          "type": "prometheus",
          "uid": "demo-prom"
        },
        "expr": "1 + 6",
        "range": false,
        "instant": true,
        "refId": "A"
      }
    ],
    "from": "now-1h",
    "to": "now"
  }`)

	req := httptest.NewRequest(http.MethodPost, "/some-path", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.Background()
	mr := &mockResponder{}
	qr := newQueryREST(builder)

	handler, err := qr.Connect(ctx, "name", nil, mr)
	require.NoError(t, err)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	require.NoError(t, mr.err, "Should not have error in responder")
	require.Equal(t, http.StatusOK, mr.statusCode, "Should return 200 status code")
	require.NotNil(t, mr.response, "Should have a response object")

	// Verify the response is the expected type
	qdr, ok := mr.response.(*queryapi.QueryDataResponse)
	require.True(t, ok, "Response should be QueryDataResponse type")
	require.NotNil(t, qdr.QueryDataResponse.Responses, "Should have responses")
	require.Contains(t, qdr.QueryDataResponse.Responses, "A", "Should contain response for refId A")

	responseA := qdr.QueryDataResponse.Responses["A"]
	require.Equal(t, backend.StatusOK, responseA.Status, "Query A should have OK status")
	require.Len(t, responseA.Frames, 1, "Query A should have one frame")

	// Verify the actual data returned includes the expected time and value
	frame := responseA.Frames[0]
	require.Equal(t, "test_frame", frame.Name, "Frame should have correct name")
	require.Len(t, frame.Fields, 2, "Frame should have 2 fields")
	require.Equal(t, "Time", frame.Fields[0].Name, "First field should be Time")
	require.Equal(t, "Value", frame.Fields[1].Name, "Second field should be Value")

	// Check that time and value 7 are returned
	timeField := frame.Fields[0]
	valueField := frame.Fields[1]
	require.Equal(t, 1, timeField.Len(), "Should have one time value")
	require.Equal(t, 1, valueField.Len(), "Should have one value")
	require.Equal(t, time.Unix(1234567890, 0), timeField.At(0), "Time should be 1234567890")
	require.Equal(t, 7.0, valueField.At(0), "Value should be 7.0")

	t.Log("Test completed successfully - time and value 7 verified")
}

type mockResponder struct {
	statusCode int
	response   runtime.Object
	err        error
}

// Object writes the provided object to the response. Invoking this method multiple times is undefined.
func (m *mockResponder) Object(statusCode int, obj runtime.Object) {
	m.statusCode = statusCode
	m.response = obj
}

// Error writes the provided error to the response. This method may only be invoked once.
func (m *mockResponder) Error(err error) {
	m.err = err
}

type mockClientSupplier struct {
}

func (m mockClientSupplier) GetDataSourceClient(ctx context.Context, ref dataapi.DataSourceRef, headers map[string]string, instanceConfig clientapi.InstanceConfigurationSettings) (clientapi.QueryDataClient, error) {
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

func (m mockClient) QueryData(ctx context.Context, req dataapi.QueryDataRequest) (*backend.QueryDataResponse, error) {
	responses := make(backend.Responses)
	for i := range req.Queries {
		refID := req.Queries[i].RefID
		frame := data.NewFrame("test_frame",
			data.NewField("Time", nil, []time.Time{time.Unix(1234567890, 0)}),
			data.NewField("Value", nil, []float64{7.0}),
		)
		responses[refID] = backend.DataResponse{
			Status: backend.StatusOK,
			Frames: []*data.Frame{frame},
		}
	}
	return &backend.QueryDataResponse{
		Responses: responses,
	}, nil
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

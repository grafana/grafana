package query

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
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

func loadTestdataFrames(t *testing.T, filename string) *backend.QueryDataResponse {
	t.Helper()

	testdataPath := filepath.Join("testdata", filename)
	data, err := os.ReadFile(testdataPath)
	require.NoError(t, err, "Failed to read testdata file: %s", filename)

	var result *backend.QueryDataResponse
	err = json.Unmarshal(data, &result)
	require.NoError(t, err, "Failed to unmarshal testdata file: %s", filename)

	return result
}

func TestQueryAPI(t *testing.T) {
	testCases := []struct {
		name               string
		queryJSON          string
		headers            map[string]string
		expectedRefIDs     []string
		expectedStatus     int
		expectedFrameCount map[string]int
		expectedFieldNames map[string][]string
		testdataFile       string
	}{
		{
			name: "single prometheus query",
			queryJSON: `{
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
			}`,
			expectedRefIDs:     []string{"A"},
			expectedStatus:     http.StatusOK,
			expectedFrameCount: map[string]int{"A": 1},
			expectedFieldNames: map[string][]string{"A": {"Time", "Value"}},
			testdataFile:       "single_prometheus_query.json",
		},
		{
			name: "prometheus query with sql expression",
			queryJSON: `{
  "queries": [
    {
      "datasource": {
        "type": "prometheus",
        "uid": "demo-prom"
      },
      "expr": "1 + 2",
      "range": false,
      "instant": true,
      "refId": "A"
    },
    {
      "datasource": {
        "uid": "__expr__",
        "type": "__expr__"
      },
      "type": "sql",
      "expression": "Select __value__ + 10 from A;",
      "refId": "B"
    }
  ],
  "from": "now-1h",
  "to": "now"
}`,
			expectedRefIDs:     []string{"A", "B"},
			expectedStatus:     http.StatusOK,
			expectedFrameCount: map[string]int{"A": 1, "B": 1},
			expectedFieldNames: map[string][]string{"A": {"Time", "Value"}, "B": {"Time", "Value"}},
			testdataFile:       "prometheus_with_sql_expression.json",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
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

			req := httptest.NewRequest(http.MethodPost, "/some-path", bytes.NewReader([]byte(tc.queryJSON)))
			req.Header.Set("Content-Type", "application/json")

			// Set optional headers
			for key, value := range tc.headers {
				req.Header.Set(key, value)
			}

			ctx := context.Background()
			mr := &mockResponder{}
			qr := newQueryREST(builder)

			handler, err := qr.Connect(ctx, "name", nil, mr)
			require.NoError(t, err)
			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, req)

			require.NoError(t, mr.err, "Should not have error in responder")
			require.Equal(t, tc.expectedStatus, mr.statusCode, "Should return expected status code")
			require.NotNil(t, mr.response, "Should have a response object")

			// Verify the response is the expected type
			qdr, ok := mr.response.(*queryapi.QueryDataResponse)
			require.True(t, ok, "Response should be QueryDataResponse type")
			require.NotNil(t, qdr.QueryDataResponse.Responses, "Should have responses")

			// Load expected frames from testdata if provided
			if tc.testdataFile != "" {
				expectedResponse := loadTestdataFrames(t, tc.testdataFile)

				// Verify all expected refIDs are present
				for _, refID := range tc.expectedRefIDs {
					require.Contains(t, qdr.QueryDataResponse.Responses, refID, "Should contain response for refId %s", refID)
					require.Contains(t, expectedResponse.Responses, refID, "Expected response should contain refId %s", refID)

					actualResponse := qdr.QueryDataResponse.Responses[refID]
					expectedFrameResponse := expectedResponse.Responses[refID]

					require.Equal(t, backend.StatusOK, actualResponse.Status, "Query %s should have OK status", refID)

					// Verify frame count
					expectedCount := tc.expectedFrameCount[refID]
					require.Len(t, actualResponse.Frames, expectedCount, "Query %s should have %d frame(s)", refID, expectedCount)

					// Verify frame structure matches testdata
					require.Len(t, actualResponse.Frames, len(expectedFrameResponse.Frames), "Frame count should match testdata for refId %s", refID)

					for i, actualFrame := range actualResponse.Frames {
						expectedFrame := expectedFrameResponse.Frames[i]

						// Compare field names and types
						require.Len(t, actualFrame.Fields, len(expectedFrame.Fields), "Field count should match for frame %d of refId %s", i, refID)

						for j, actualField := range actualFrame.Fields {
							expectedField := expectedFrame.Fields[j]
							require.Equal(t, expectedField.Name, actualField.Name, "Field %d name should match for frame %d of refId %s", j, i, refID)
							require.Equal(t, expectedField.Type(), actualField.Type(), "Field %d type should match for frame %d of refId %s", j, i, refID)
						}
					}
				}
			} else {
				// Fallback to original verification logic for tests without testdata
				for _, refID := range tc.expectedRefIDs {
					require.Contains(t, qdr.QueryDataResponse.Responses, refID, "Should contain response for refId %s", refID)

					response := qdr.QueryDataResponse.Responses[refID]
					require.Equal(t, backend.StatusOK, response.Status, "Query %s should have OK status", refID)

					// Verify frame count
					expectedCount := tc.expectedFrameCount[refID]
					require.Len(t, response.Frames, expectedCount, "Query %s should have %d frame(s)", refID, expectedCount)

					// Verify frame structure
					for i, frame := range response.Frames {
						require.Equal(t, "test_frame", frame.Name, "Frame %d should have correct name", i)

						expectedFields := tc.expectedFieldNames[refID]
						require.Len(t, frame.Fields, len(expectedFields), "Frame %d should have %d fields", i, len(expectedFields))

						for j, expectedFieldName := range expectedFields {
							require.Equal(t, expectedFieldName, frame.Fields[j].Name, "Field %d should be named %s", j, expectedFieldName)
						}
					}
				}
			}

			t.Logf("Test case '%s' completed successfully", tc.name)
		})
	}
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

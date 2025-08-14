package query

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
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

	// Validate filename doesn't contain path traversal
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") {
		t.Fatalf("Invalid test filename: %s", filename)
	}

	testdataPath := filepath.Join("testdata", filename)
	data, err := os.ReadFile(testdataPath) // #nosec G304 -- testdata files in tests
	require.NoError(t, err, "Failed to read testdata file: %s", filename)

	var result *backend.QueryDataResponse
	err = json.Unmarshal(data, &result)
	require.NoError(t, err, "Failed to unmarshal testdata file: %s", filename)

	return result
}

func TestQueryAPI(t *testing.T) {
	testCases := []struct {
		name           string
		queryJSON      string
		headers        map[string]string
		expectedStatus int
		testdataFile   string
		stubbedFrame   *data.Frame
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
			expectedStatus: http.StatusOK,
			testdataFile:   "single_prometheus_query.json",
			stubbedFrame: data.NewFrame("",
				data.NewField("Time", nil, []time.Time{time.Unix(1704067200, 0)}),
				data.NewField("Value", nil, []float64{7.0}),
			),
		},

		{
			name: "prometheus query with server side expression",
			queryJSON: `{
				"queries": [
					{
				      	"refId": "A",
						"datasource": {
							"type": "prometheus",
							"uid": "demo-prom"
						},
						"expr": "7",
						"range": false,
						"instant": true,
						"hide": true
					},
					{
						"refId": "B",
						"datasource": {
							"uid": "__expr__",
							"type": "__expr__"
						},
						"type": "math",
						"expression": "$A * 3"
					}
				],
				"from": "now-1h",
				"to": "now"
			}`,
			testdataFile:   "prometheus_with_sse.json",
			expectedStatus: http.StatusOK,
			stubbedFrame: data.NewFrame("",
				data.NewField("Value", nil, []float64{7.0}),
			),
		},

		{
			name: "prometheus query with sql expression and hidden prom query",
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
						"refId": "A",
						"hidden": true
					},
					{
						"datasource": {
							"uid": "__expr__",
							"type": "__expr__"
						},
						"type": "sql",
						"expression": "Select Value + 10 from A;",
						"refId": "B"
					}
				],
				"from": "now-1h",
				"to": "now"
			}`,
			testdataFile:   "prometheus_with_sql_expression.json",
			expectedStatus: http.StatusOK,
			stubbedFrame: data.NewFrame("",
				data.NewField("Time", nil, []time.Time{time.Unix(1704067200, 0)}),
				data.NewField("Value", nil, []float64{7.0}),
			),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			builder := &QueryAPIBuilder{
				converter: &expr.ResultConverter{
					Features: featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions),
					Tracer:   tracing.InitializeTracerForTest(),
				},
				instanceProvider: mockClient{
					stubbedFrame: tc.stubbedFrame,
				},
				tracer:                 tracing.InitializeTracerForTest(),
				log:                    log.New("test"),
				legacyDatasourceLookup: &mockLegacyDataSourceLookup{},
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
			require.NotNil(t, qdr.Responses, "Should have responses")

			// Load expected frames from testdata if provided
			if tc.testdataFile != "" {
				expectedResponse := loadTestdataFrames(t, tc.testdataFile)

				// get refids from expected response
				expectedRefIds := make([]string, 0, len(expectedResponse.Responses))
				for refID := range expectedResponse.Responses {
					expectedRefIds = append(expectedRefIds, refID)
				}

				// Verify all expected refIDs are present
				for _, refID := range expectedRefIds {
					require.Contains(t, qdr.Responses, refID, "Should contain response for refId %s", refID)

					actualResponse := qdr.Responses[refID]
					expectedFrameResponse := expectedResponse.Responses[refID]

					// Verify frame structure matches testdata
					require.Len(t, actualResponse.Frames, len(expectedFrameResponse.Frames), "Frame count should match testdata for refId %s", refID)

					for i, actualFrame := range actualResponse.Frames {
						expectedFrame := expectedFrameResponse.Frames[i]
						if diff := cmp.Diff(expectedFrame, actualFrame, data.FrameTestCompareOptions()...); diff != "" {
							require.FailNowf(t, "Result mismatch (-want +got):%s", diff)
						}
					}
				}
			} else {
				t.Fatalf("No testdata file provided for test case %s", tc.name)
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

type mockClient struct {
	stubbedFrame *data.Frame
}

func (m mockClient) GetInstance(ctx context.Context, headers map[string]string) (clientapi.Instance, error) {
	mclient := mockClient{
		stubbedFrame: m.stubbedFrame,
	}
	return mclient, nil
}

func (m mockClient) ReportMetrics() {
}

func (m mockClient) GetLogger(parent log.Logger) log.Logger {
	return parent.New()
}

func (m mockClient) GetDataSourceClient(ctx context.Context, ref dataapi.DataSourceRef) (clientapi.QueryDataClient, error) {
	mclient := mockClient{
		stubbedFrame: m.stubbedFrame,
	}
	return mclient, nil
}

func (m mockClient) QueryData(ctx context.Context, req dataapi.QueryDataRequest) (*backend.QueryDataResponse, error) {
	responses := make(backend.Responses)
	for i := range req.Queries {
		refID := req.Queries[i].RefID
		frame := m.stubbedFrame
		frame.RefID = refID
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

func (m mockClient) GetSettings() clientapi.InstanceConfigurationSettings {
	return clientapi.InstanceConfigurationSettings{
		ExpressionsEnabled: true,
		FeatureToggles:     featuremgmt.WithFeatures(featuremgmt.FlagSqlExpressions),
	}
}

type mockLegacyDataSourceLookup struct{}

func (m *mockLegacyDataSourceLookup) GetDataSourceFromDeprecatedFields(ctx context.Context, name string, id int64) (*dataapi.DataSourceRef, error) {
	return &dataapi.DataSourceRef{
		UID:  "demo-prom",
		Type: "prometheus",
	}, nil
}

func TestMergeHeaders(t *testing.T) {
	tests := []struct {
		name     string
		h1       http.Header
		h2       http.Header
		expected http.Header
	}{
		{
			name: "into empty",
			h1:   http.Header{},
			h2: http.Header{
				"A": {"1", "2"},
				"B": {"3"},
			},
			expected: http.Header{
				"A": {"1", "2"},
				"B": {"3"},
			},
		},
		{
			name: "from empty",
			h1: http.Header{
				"A": {"1", "2"},
				"B": {"3"},
			},
			h2: http.Header{},
			expected: http.Header{
				"A": {"1", "2"},
				"B": {"3"},
			},
		},
		{
			name: "from nil",
			h1: http.Header{
				"A": {"1", "2"},
				"B": {"3"},
			},
			h2: nil,
			expected: http.Header{
				"A": {"1", "2"},
				"B": {"3"},
			},
		},
		{
			name: "no merging",
			h1: http.Header{
				"A": {"1", "2"},
			},
			h2: http.Header{
				"B": {"3", "4"},
			},
			expected: http.Header{
				"A": {"1", "2"},
				"B": {"3", "4"},
			},
		},
		{
			name: "with merging",
			h1: http.Header{
				"A": {"1", "2"},
			},
			h2: http.Header{
				"A": {"3", "4"},
			},
			expected: http.Header{
				"A": {"1", "2", "3", "4"},
			},
		},
		{
			name: "with duplicates",
			h1: http.Header{
				"A": {"1", "2"},
			},
			h2: http.Header{
				"A": {"2", "3"},
			},
			expected: http.Header{
				"A": {"1", "2", "3"},
			},
		},
		{
			name: "with all",
			h1: http.Header{
				"A": {"1", "2", "3"},
				"B": {"4"},
			},
			h2: http.Header{
				"A": {"3", "4"},
				"B": {"5"},
				"C": {"6"},
			},
			expected: http.Header{
				"A": {"1", "2", "3", "4"},
				"B": {"4", "5"},
				"C": {"6"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h1 := tt.h1.Clone() // don't mutate the test-data
			mergeHeaders(h1, tt.h2, log.New("test.logger"))
			require.Equal(t, tt.expected, h1)
		})
	}
}

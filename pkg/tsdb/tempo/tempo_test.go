package tempo

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/tsdb/tempo/kinds/dataquery"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCheckHealth(t *testing.T) {
	tests := []struct {
		name            string
		httpStatusCode  int
		expectedStatus  backend.HealthStatus
		expectedMessage string
	}{
		{
			name:            "successful health check",
			httpStatusCode:  200,
			expectedStatus:  backend.HealthStatusOk,
			expectedMessage: "Data source is working",
		},
		{
			name:            "http error",
			httpStatusCode:  500,
			expectedStatus:  backend.HealthStatusError,
			expectedMessage: "Tempo echo endpoint returned status 500",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.httpStatusCode)
			}))
			defer server.Close()

			pluginCtx := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					URL: server.URL,
				},
			}

			im := datasource.NewInstanceManager(func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
				dsInfo := &DatasourceInfo{
					URL:             server.URL,
					HTTPClient:      server.Client(),
					StreamingClient: nil,
				}
				return dsInfo, nil
			})

			service := &Service{im: im}
			ctx := backend.WithPluginContext(context.Background(), pluginCtx)
			result, err := service.CheckHealth(ctx, &backend.CheckHealthRequest{})

			assert.NoError(t, err)
			assert.Equal(t, tt.expectedStatus, result.Status)
			assert.Contains(t, result.Message, tt.expectedMessage)
		})
	}
}

func TestQueryDataPropagatesPlaintextHTTPErrorInDataResponse(t *testing.T) {
	tests := []struct {
		name      string
		queryType dataquery.TempoQueryType
		queryJSON string
	}{
		{
			name:      "trace",
			queryType: dataquery.TempoQueryTypeTraceId,
			queryJSON: `{"query":"abc123"}`,
		},
		{
			name:      "traceql search",
			queryType: dataquery.TempoQueryTypeTraceql,
			queryJSON: `{"query":"{ .service.name = \"api\" }"}`,
		},
		{
			name:      "traceql metrics",
			queryType: dataquery.TempoQueryTypeTraceql,
			queryJSON: `{"query":"{} | rate()"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			const apiError = "tempo API plaintext error"
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				http.Error(w, apiError, http.StatusInternalServerError)
			}))
			defer server.Close()

			im := datasource.NewInstanceManager(func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
				return &DatasourceInfo{
					URL:        server.URL,
					HTTPClient: server.Client(),
				}, nil
			})

			service := &Service{
				im:     im,
				logger: backend.NewLoggerWith("logger", "tempo-test"),
			}

			response, err := service.QueryData(context.Background(), &backend.QueryDataRequest{
				PluginContext: backend.PluginContext{
					DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{URL: server.URL},
				},
				Queries: []backend.DataQuery{
					{
						RefID:     "A",
						QueryType: string(tt.queryType),
						JSON:      []byte(tt.queryJSON),
						TimeRange: backend.TimeRange{
							From: time.Unix(1, 0),
							To:   time.Unix(2, 0),
						},
					},
				},
			})

			require.NoError(t, err)
			require.Contains(t, response.Responses, "A")
			dataResponse := response.Responses["A"]
			require.Error(t, dataResponse.Error)
			assert.Equal(t, apiError+"\n", dataResponse.Error.Error())
			assert.Equal(t, backend.Status(http.StatusInternalServerError), dataResponse.Status)
			assert.Equal(t, backend.ErrorSourceDownstream, dataResponse.ErrorSource)
		})
	}
}

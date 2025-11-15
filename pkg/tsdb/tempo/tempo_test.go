package tempo

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/stretchr/testify/assert"
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

package jaeger

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDataSourceInstanceSettings_TraceIdTimeEnabled(t *testing.T) {
	tests := []struct {
		name            string
		jsonData        string
		expectedEnabled bool
		expectError     bool
	}{
		{
			name: "traceIdTimeParams enabled",
			jsonData: `{
				"traceIdTimeParams": {
					"enabled": true
				}
			}`,
			expectedEnabled: true,
			expectError:     false,
		},
		{
			name: "traceIdTimeParams disabled",
			jsonData: `{
				"traceIdTimeParams": {
					"enabled": false
				}
			}`,
			expectedEnabled: false,
			expectError:     false,
		},
		{
			name:            "traceIdTimeParams not specified",
			jsonData:        `{}`,
			expectedEnabled: false,
			expectError:     false,
		},
		{
			name:            "traceIdTimeParams without enabled",
			jsonData:        `{"traceIdTimeParams":{}}`,
			expectedEnabled: false,
			expectError:     false,
		},
		{
			name:            "Invalid JSON",
			jsonData:        `{invalid json`,
			expectedEnabled: false,
			expectError:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create instance settings
			settings := backend.DataSourceInstanceSettings{
				JSONData: []byte(tt.jsonData),
				URL:      "http://localhost:16686",
			}

			// Create instance factory
			factory := newInstanceSettings(httpclient.NewProvider())
			instance, err := factory(context.Background(), settings)

			if tt.expectError {
				assert.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, instance)

			// Get the datasource info
			dsInfo, ok := instance.(*datasourceInfo)
			require.True(t, ok)
			require.NotNil(t, dsInfo)

			// Verify the client's traceIdTimeEnabled parameter

			var jsonData SettingsJSONData
			if err := json.Unmarshal(dsInfo.JaegerClient.settings.JSONData, &jsonData); err != nil {
				t.Fatalf("failed to parse settings JSON data: %v", err)
			}

			assert.Equal(t, tt.expectedEnabled, jsonData.TraceIdTimeParams.Enabled)
		})
	}
}

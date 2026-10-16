package azuremonitor

import (
	"testing"

	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetAzureMonitorRoutesMetricsDataPlane(t *testing.T) {
	tests := []struct {
		name           string
		cloud          string
		expectedURL    string
		expectedScopes []string
	}{
		{
			name:           "public cloud",
			cloud:          azsettings.AzurePublic,
			expectedURL:    "https://metrics.monitor.azure.com",
			expectedScopes: []string{"https://metrics.monitor.azure.com/.default"},
		},
		{
			name:           "china cloud",
			cloud:          azsettings.AzureChina,
			expectedURL:    "https://metrics.monitor.azure.cn",
			expectedScopes: []string{"https://metrics.monitor.azure.cn/.default"},
		},
		{
			name:           "us government cloud",
			cloud:          azsettings.AzureUSGovernment,
			expectedURL:    "https://metrics.monitor.azure.us",
			expectedScopes: []string{"https://metrics.monitor.azure.us/.default"},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			creds := &azcredentials.AzureClientSecretCredentials{AzureCloud: tc.cloud}
			routes, err := getAzureMonitorRoutes(&azsettings.AzureSettings{}, creds, nil)
			require.NoError(t, err)

			route, ok := routes[azureMonitorBatchMetrics]
			require.True(t, ok, "batch metrics route must be defined for %s", tc.cloud)
			assert.Equal(t, tc.expectedURL, route.URL)
			assert.Equal(t, tc.expectedScopes, route.Scopes)
		})
	}
}

package azuremonitor

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestInsightsAnalyticsCreateRequest(t *testing.T) {
	ctx := context.Background()
	url := "http://ds"
	dsInfo := datasourceInfo{
		Settings: azureMonitorSettings{AppInsightsAppId: "foo"},
		DecryptedSecureJSONData: map[string]string{
			"appInsightsApiKey": "key",
		},
	}

	tests := []struct {
		name            string
		expectedURL     string
		expectedHeaders http.Header
		Err             require.ErrorAssertionFunc
	}{
		{
			name:        "creates a request",
			expectedURL: "http://ds/v1/apps/foo",
			Err:         require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ds := InsightsAnalyticsDatasource{}
			req, err := ds.createRequest(ctx, dsInfo, url)
			tt.Err(t, err)
			if req.URL.String() != tt.expectedURL {
				t.Errorf("Expecting %s, got %s", tt.expectedURL, req.URL.String())
			}
		})
	}
}

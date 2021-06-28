package azuremonitor

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
)

func TestInsightsAnalyticsCreateRequest(t *testing.T) {
	ctx := context.Background()
	dsInfo := datasourceInfo{
		Settings: azureMonitorSettings{AppInsightsAppId: "foo"},
		Services: map[string]datasourceService{
			insightsAnalytics: {URL: "http://ds"},
		},
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
			expectedHeaders: http.Header{
				"X-Api-Key": []string{"key"},
			},
			Err: require.NoError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ds := InsightsAnalyticsDatasource{}
			req, err := ds.createRequest(ctx, dsInfo)
			tt.Err(t, err)
			if req.URL.String() != tt.expectedURL {
				t.Errorf("Expecting %s, got %s", tt.expectedURL, req.URL.String())
			}
			if !cmp.Equal(req.Header, tt.expectedHeaders) {
				t.Errorf("Unexpected HTTP headers: %v", cmp.Diff(req.Header, tt.expectedHeaders))
			}
		})
	}
}

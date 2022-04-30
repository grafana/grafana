package api

import (
	"fmt"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/assert"
	"net/http"
	"strings"
	"testing"
)

func TestApiBehindFeatureFlag(t *testing.T) {
	testCases := []struct {
		name                 string
		featureFlags         []string
		expectedHttpResponse int
	}{
		{
			name:                 "returns 404 when feature flag not enabled",
			featureFlags:         []string{},
			expectedHttpResponse: http.StatusNotFound,
		},
		{
			name:                 "returns 200 when feature flag is enabled",
			featureFlags:         []string{featuremgmt.FlagPublicDashboards},
			expectedHttpResponse: http.StatusOK,
		},
	}

	for _, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			sc := setupHTTPServerWithMockDb(t, false, false, test.featureFlags)
			sc.hs.dashboardService = &dashboards.FakeDashboardService{
				SaveDashboardSharingConfigResult: &models.DashboardSharingConfig{IsPublic: false},
			}
			setInitCtxSignedInViewer(sc.initCtx)
			response := callAPI(
				sc.server,
				http.MethodPost,
				fmt.Sprintf("/api/dashboards/uid/1/public_dashboard"),
				strings.NewReader("{ isPublic: true }"),
				t,
			)
			assert.Equal(t, test.expectedHttpResponse, response.Code)
		})
	}

}

func TestReturnsSuccessWhenFeatureEnabledAndSetsPublicFlagOnDashboard(t *testing.T) {
	sc := setupHTTPServerWithMockDb(t, false, false, []string{featuremgmt.FlagPublicDashboards})
	setInitCtxSignedInViewer(sc.initCtx)

	sc.hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards, true)
	sc.hs.dashboardService = &dashboards.FakeDashboardService{
		SaveDashboardSharingConfigResult: &models.DashboardSharingConfig{IsPublic: false},
	}

	t.Run("get 200 when feature flag on and public flag set on dashboard", func(t *testing.T) {
		response := callAPI(
			sc.server,
			http.MethodPost,
			"/api/dashboards/uid/1/public_dashboard",
			strings.NewReader(`{ "isPublic": true }`),
			t,
		)

		assert.Equal(t, http.StatusOK, response.Code)
		respJSON, _ := simplejson.NewJson(response.Body.Bytes())
		val, _ := respJSON.Get("isPublic").Bool()
		assert.Equal(t, true, val)
	})
}

package api

import (
	"errors"
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
				SavePublicDashboardConfigResult: &models.PublicDashboardConfig{IsPublic: false},
			}
			setInitCtxSignedInViewer(sc.initCtx)
			response := callAPI(
				sc.server,
				http.MethodPost,
				fmt.Sprintf("/api/dashboards/uid/1/public-config"),
				strings.NewReader(`{ "isPublic": true }`),
				t,
			)
			assert.Equal(t, test.expectedHttpResponse, response.Code)
		})
	}

}

func TestApiPersistsValue(t *testing.T) {

	testCases := []struct {
		name                 string
		dashboardUid         string
		expectedHttpResponse int
		saveDashboardError   error
		isPublicResult       bool
	}{
		{
			name:                 "returns 200 when update persists",
			dashboardUid:         "1",
			expectedHttpResponse: http.StatusOK,
			saveDashboardError:   nil,
			isPublicResult:       true,
		},
		{
			name:                 "returns 500 when not persisted",
			expectedHttpResponse: http.StatusInternalServerError,
			saveDashboardError:   errors.New("backend failed to save"),
			isPublicResult:       false,
		},
		{
			name:                 "returns 404 when dashboard not found",
			expectedHttpResponse: http.StatusNotFound,
			saveDashboardError:   models.ErrDataSourceNotFound,
			isPublicResult:       false,
		},
	}

	for _, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			sc := setupHTTPServerWithMockDb(t, false, false, []string{featuremgmt.FlagPublicDashboards})

			sc.hs.dashboardService = &dashboards.FakeDashboardService{
				SavePublicDashboardConfigResult: &models.PublicDashboardConfig{IsPublic: test.isPublicResult},
				SaveDashboardError:              test.saveDashboardError,
			}

			setInitCtxSignedInViewer(sc.initCtx)
			response := callAPI(
				sc.server,
				http.MethodPost,
				fmt.Sprintf("/api/dashboards/uid/1/public-config"),
				strings.NewReader(`{ "isPublic": true }`),
				t,
			)
			assert.Equal(t, test.expectedHttpResponse, response.Code)

			// check the result if it's a 200
			if test.isPublicResult {
				respJSON, _ := simplejson.NewJson(response.Body.Bytes())
				val, _ := respJSON.Get("isPublic").Bool()
				assert.Equal(t, test.isPublicResult, val)
			}

		})
	}
}

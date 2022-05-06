package api

import (
	"encoding/json"
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

func TestApiRetrieveConfig(t *testing.T) {
	pdc := &models.PublicDashboardConfig{IsPublic: true}

	testCases := []struct {
		name                        string
		dashboardUid                string
		expectedHttpResponse        int
		publicDashboardConfigResult *models.PublicDashboardConfig
		publicDashboardConfigError  error
	}{
		{
			name:                        "retrieves public dashboard config when dashboard is found",
			dashboardUid:                "1",
			expectedHttpResponse:        http.StatusOK,
			publicDashboardConfigResult: pdc,
			publicDashboardConfigError:  nil,
		},
		{
			name:                        "returns 404 when dashboard not found",
			dashboardUid:                "77777",
			expectedHttpResponse:        http.StatusNotFound,
			publicDashboardConfigResult: nil,
			publicDashboardConfigError:  models.ErrDashboardNotFound,
		},
		{
			name:                        "returns 500 when internal server error",
			dashboardUid:                "1",
			expectedHttpResponse:        http.StatusInternalServerError,
			publicDashboardConfigResult: nil,
			publicDashboardConfigError:  errors.New("database broken"),
		},
	}

	for _, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			sc := setupHTTPServerWithMockDb(t, false, false, []string{featuremgmt.FlagPublicDashboards})

			sc.hs.dashboardService = &dashboards.FakeDashboardService{
				PublicDashboardConfigResult: test.publicDashboardConfigResult,
				PublicDashboardConfigError:  test.publicDashboardConfigError,
			}

			setInitCtxSignedInViewer(sc.initCtx)
			response := callAPI(
				sc.server,
				http.MethodGet,
				fmt.Sprintf("/api/dashboards/uid/1/public-config"),
				nil,
				t,
			)

			assert.Equal(t, test.expectedHttpResponse, response.Code)

			if test.expectedHttpResponse == http.StatusOK {
				var pdcResp models.PublicDashboardConfig
				json.Unmarshal(response.Body.Bytes(), &pdcResp)
				assert.Equal(t, test.publicDashboardConfigResult, &pdcResp)
			}

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
			saveDashboardError:   models.ErrDashboardNotFound,
			isPublicResult:       false,
		},
	}

	for _, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			sc := setupHTTPServerWithMockDb(t, false, false, []string{featuremgmt.FlagPublicDashboards})

			sc.hs.dashboardService = &dashboards.FakeDashboardService{
				PublicDashboardConfigResult: &models.PublicDashboardConfig{IsPublic: test.isPublicResult},
				PublicDashboardConfigError:  test.saveDashboardError,
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

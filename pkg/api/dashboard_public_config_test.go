package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
			sc := setupHTTPServerWithMockDb(t, false, false, featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards))
			dashSvc := dashboards.NewFakeDashboardService(t)
			dashSvc.On("GetPublicDashboardConfig", mock.Anything, mock.AnythingOfType("int64"), mock.AnythingOfType("string")).
				Return(test.publicDashboardConfigResult, test.publicDashboardConfigError)
			sc.hs.dashboardService = dashSvc

			setInitCtxSignedInViewer(sc.initCtx)
			response := callAPI(
				sc.server,
				http.MethodGet,
				"/api/dashboards/uid/1/public-config",
				nil,
				t,
			)

			assert.Equal(t, test.expectedHttpResponse, response.Code)

			if test.expectedHttpResponse == http.StatusOK {
				var pdcResp models.PublicDashboardConfig
				err := json.Unmarshal(response.Body.Bytes(), &pdcResp)
				require.NoError(t, err)
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
	}{
		{
			name:                 "returns 200 when update persists",
			dashboardUid:         "1",
			expectedHttpResponse: http.StatusOK,
			saveDashboardError:   nil,
		},
		{
			name:                 "returns 500 when not persisted",
			expectedHttpResponse: http.StatusInternalServerError,
			saveDashboardError:   errors.New("backend failed to save"),
		},
		{
			name:                 "returns 404 when dashboard not found",
			expectedHttpResponse: http.StatusNotFound,
			saveDashboardError:   models.ErrDashboardNotFound,
		},
	}

	for _, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			sc := setupHTTPServerWithMockDb(t, false, false, featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards))
			dashSvc := dashboards.NewFakeDashboardService(t)
			dashSvc.On("SavePublicDashboardConfig", mock.Anything, mock.AnythingOfType("*dashboards.SavePublicDashboardConfigDTO")).
				Return(&models.PublicDashboardConfig{IsPublic: true}, test.saveDashboardError)
			sc.hs.dashboardService = dashSvc

			setInitCtxSignedInViewer(sc.initCtx)
			response := callAPI(
				sc.server,
				http.MethodPost,
				"/api/dashboards/uid/1/public-config",
				strings.NewReader(`{ "isPublic": true }`),
				t,
			)

			assert.Equal(t, test.expectedHttpResponse, response.Code)

			// check the result if it's a 200
			if response.Code == http.StatusOK {
				respJSON, _ := simplejson.NewJson(response.Body.Bytes())
				val, _ := respJSON.Get("isPublic").Bool()
				assert.Equal(t, true, val)
			}
		})
	}
}

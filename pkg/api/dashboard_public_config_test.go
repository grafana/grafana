package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

			sc.hs.dashboardService = &dashboards.FakeDashboardService{
				PublicDashboardConfigResult: test.publicDashboardConfigResult,
				PublicDashboardConfigError:  test.publicDashboardConfigError,
			}

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
		Name                  string
		DashboardUid          string
		PublicDashboardConfig *models.PublicDashboardConfig
		ExpectedHttpResponse  int
		SaveDashboardError    error
	}{
		{
			Name:                  "returns 200 when update persists",
			DashboardUid:          "1",
			PublicDashboardConfig: &models.PublicDashboardConfig{IsPublic: true},
			ExpectedHttpResponse:  http.StatusOK,
			SaveDashboardError:    nil,
		},
		{
			Name:         "it overwrites an existing uid for public dashboard",
			DashboardUid: "1",
			PublicDashboardConfig: &models.PublicDashboardConfig{
				IsPublic: true,
				PublicDashboard: models.PublicDashboard{
					Uid:               "",
					DashboardUid:      "1",
					OrgId:             1,
					TemplateVariables: "",
					TimeVariables:     "",
				},
			},
			ExpectedHttpResponse: http.StatusOK,
		},
		{
			Name:                  "returns 500 when not persisted",
			ExpectedHttpResponse:  http.StatusInternalServerError,
			PublicDashboardConfig: &models.PublicDashboardConfig{},
			SaveDashboardError:    errors.New("backend failed to save"),
		},
		{
			Name:                  "returns 404 when dashboard not found",
			ExpectedHttpResponse:  http.StatusNotFound,
			PublicDashboardConfig: &models.PublicDashboardConfig{},
			SaveDashboardError:    models.ErrDashboardNotFound,
		},
	}

	for _, test := range testCases {
		t.Run(test.Name, func(t *testing.T) {
			sc := setupHTTPServerWithMockDb(t, false, false, featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards))

			sc.hs.dashboardService = &dashboards.FakeDashboardService{
				PublicDashboardConfigResult: test.PublicDashboardConfig,
				PublicDashboardConfigError:  test.SaveDashboardError,
			}

			setInitCtxSignedInViewer(sc.initCtx)
			response := callAPI(
				sc.server,
				http.MethodPost,
				"/api/dashboards/uid/1/public-config",
				strings.NewReader(`{ "isPublic": true }`),
				t,
			)

			assert.Equal(t, test.ExpectedHttpResponse, response.Code)

			// check the result if it's a 200
			if response.Code == http.StatusOK {
				val, _ := json.Marshal(test.PublicDashboardConfig)
				assert.Equal(t, string(val), response.Body.String())
			}
		})
	}
}

//func TestApiOverwritesExistingPublicDashboard(t *testing.T) {
//  testCase := struct {
//    Name                  string
//    DashboardUid          string
//    PublicDashboardConfig *models.PublicDashboardConfig
//    ExpectedHttpResponse  int
//    SaveDashboardError    error
//  }{
//    DashboardUid: "1",
//    PublicDashboardConfig: &models.PublicDashboardConfig{
//      IsPublic: true,
//      PublicDashboard: models.PublicDashboard{
//        Uid:               "",
//        DashboardUid:      "1",
//        OrgId:             1,
//        TemplateVariables: "",
//        TimeVariables:     "",
//      },
//    },
//    ExpectedHttpResponse: http.StatusOK,
//  }

//  t.Run(testCase.Name, func(t *testing.T) {
//    sc := setupHTTPServerWithMockDb(t, false, false, featuremgmt.WithFeatures(featuremgmt.FlagPublicDashboards))

//    sc.hs.dashboardService = &dashboards.FakeDashboardService{
//      PublicDashboardConfigResult: testCase.PublicDashboardConfig,
//      PublicDashboardConfigError:  testCase.SaveDashboardError,
//    }

//    setInitCtxSignedInViewer(sc.initCtx)
//    response := callAPI(
//      sc.server,
//      http.MethodPost,
//      "/api/dashboards/uid/1/public-config",
//      strings.NewReader(`{ "isPublic": true }`),
//      t,
//    )

//    assert.Equal(t, testCase.ExpectedHttpResponse, response.Code)

//    // check the result if it's a 200
//    if response.Code == http.StatusOK {
//      val, _ := json.Marshal(testCase.PublicDashboardConfig)
//      assert.Equal(t, string(val), response.Body.String())
//    }
//  })
//}

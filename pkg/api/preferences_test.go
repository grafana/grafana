package api

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/preference/preftest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

var (
	getOrgPreferencesURL    = "/api/org/preferences/"
	putOrgPreferencesURL    = "/api/org/preferences/"
	patchOrgPreferencesUrl  = "/api/org/preferences/"
	patchUserPreferencesUrl = "/api/user/preferences/"

	testUpdateOrgPreferencesCmd                     = `{ "theme": "light", "homeDashboardId": 1 }`
	testPatchOrgPreferencesCmd                      = `{"navbar":{"savedItems":[{"id":"snapshots","text":"Snapshots","icon":"camera","url":"/dashboard/snapshots"}]}}`
	testPatchOrgPreferencesCmdBad                   = `this is not json`
	testPatchUserPreferencesCmd                     = `{"navbar":{"savedItems":[{"id":"snapshots","text":"Snapshots","icon":"camera","url":"/dashboard/snapshots"}]}}`
	testPatchUserPreferencesCmdBad                  = `this is not json`
	testUpdateOrgPreferencesWithHomeDashboardUIDCmd = `{ "theme": "light", "homeDashboardUID": "home"}`
)

func TestAPIEndpoint_GetCurrentOrgPreferences_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	dashSvc := dashboards.NewFakeDashboardService(t)
	qResult := &dashboards.Dashboard{UID: "home", ID: 1}
	dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(qResult, nil)

	prefService := preftest.NewPreferenceServiceFake()
	prefService.ExpectedPreference = &pref.Preference{HomeDashboardID: 1, Theme: "dark"}

	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = cfg
		hs.DashboardService = dashSvc
		hs.preferenceService = prefService
	})

	t.Run("Viewer cannot get org preferences", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(server.NewGetRequest(getOrgPreferencesURL), &user.SignedInUser{OrgID: 1, OrgRole: org.RoleViewer})
		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Org Admin can get org preferences", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(server.NewGetRequest(getOrgPreferencesURL), &user.SignedInUser{OrgID: 1, OrgRole: org.RoleAdmin})
		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		var resp map[string]interface{}
		b, err := io.ReadAll(res.Body)
		assert.NoError(t, err)
		assert.NoError(t, json.Unmarshal(b, &resp))
		assert.Equal(t, "home", resp["homeDashboardUID"])
		require.NoError(t, res.Body.Close())
	})
}

func TestAPIEndpoint_GetCurrentOrgPreferences_AccessControl(t *testing.T) {
	prefService := preftest.NewPreferenceServiceFake()
	prefService.ExpectedPreference = &pref.Preference{HomeDashboardID: 1, Theme: "dark"}

	dashSvc := dashboards.NewFakeDashboardService(t)
	qResult := &dashboards.Dashboard{UID: "home", ID: 1}
	dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(qResult, nil)

	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.preferenceService = prefService
		hs.DashboardService = dashSvc
	})

	t.Run("AccessControl allows getting org preferences with correct permissions", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(server.NewGetRequest(getOrgPreferencesURL), userWithPermissions(1, []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsPreferencesRead}}))
		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
	t.Run("AccessControl prevents getting org preferences with correct permissions in another org", func(t *testing.T) {
		// Set permissions in org 2, but set current org to org 1
		user := userWithPermissions(2, []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsPreferencesRead}})
		user.OrgID = 1

		req := webtest.RequestWithSignedInUser(server.NewGetRequest(getOrgPreferencesURL), user)
		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
	t.Run("AccessControl prevents getting org preferences with incorrect permissions", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(server.NewGetRequest(getOrgPreferencesURL), userWithPermissions(1, []accesscontrol.Permission{{Action: "orgs:invalid"}}))
		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func TestAPIEndpoint_PutCurrentOrgPreferences_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false

	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = cfg
		hs.preferenceService = preftest.NewPreferenceServiceFake()
	})

	input := strings.NewReader(testUpdateOrgPreferencesCmd)
	t.Run("Viewer cannot update org preferences", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(server.NewRequest(http.MethodPut, putOrgPreferencesURL, input), &user.SignedInUser{
			OrgID:   1,
			OrgRole: org.RoleViewer,
		})
		response, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, response.StatusCode)
		require.NoError(t, response.Body.Close())
	})

	input = strings.NewReader(testUpdateOrgPreferencesCmd)
	t.Run("Org Admin can update org preferences", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(server.NewRequest(http.MethodPut, putOrgPreferencesURL, input), &user.SignedInUser{
			OrgID:   1,
			OrgRole: org.RoleAdmin,
		})
		response, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, response.StatusCode)
		require.NoError(t, response.Body.Close())
	})
}

func TestAPIEndpoint_PutCurrentOrgPreferences_AccessControl(t *testing.T) {
	prefService := preftest.NewPreferenceServiceFake()
	prefService.ExpectedPreference = &pref.Preference{HomeDashboardID: 1, Theme: "dark"}

	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.preferenceService = prefService
	})

	input := strings.NewReader(testUpdateOrgPreferencesCmd)
	t.Run("AccessControl allows updating org preferences with correct permissions", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(server.NewRequest(http.MethodPut, putOrgPreferencesURL, input), userWithPermissions(1, []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsPreferencesWrite}}))
		response, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, response.StatusCode)
		require.NoError(t, response.Body.Close())
	})

	input = strings.NewReader(testUpdateOrgPreferencesCmd)
	t.Run("AccessControl prevents updating org preferences with correct permissions in another org", func(t *testing.T) {
		user := userWithPermissions(2, []accesscontrol.Permission{{Action: accesscontrol.ActionOrgsPreferencesWrite}})
		user.OrgID = 1
		req := webtest.RequestWithSignedInUser(server.NewRequest(http.MethodPut, putOrgPreferencesURL, input), user)
		response, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, response.StatusCode)
		require.NoError(t, response.Body.Close())
	})

	input = strings.NewReader(testUpdateOrgPreferencesCmd)
	t.Run("AccessControl prevents updating org preferences with incorrect permissions", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(server.NewRequest(http.MethodPut, putOrgPreferencesURL, input), userWithPermissions(1, []accesscontrol.Permission{{Action: "orgs:invalid"}}))
		response, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, response.StatusCode)
		require.NoError(t, response.Body.Close())
	})
}

func TestAPIEndpoint_PatchUserPreferences(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false

	dashSvc := dashboards.NewFakeDashboardService(t)
	qResult := &dashboards.Dashboard{UID: "home", ID: 1}
	dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(qResult, nil)

	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = cfg
		hs.preferenceService = preftest.NewPreferenceServiceFake()
		hs.DashboardService = dashSvc
	})

	input := strings.NewReader(testPatchUserPreferencesCmd)
	t.Run("Returns 200 on success", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(server.NewRequest(http.MethodPatch, patchUserPreferencesUrl, input), &user.SignedInUser{
			OrgID:   1,
			OrgRole: org.RoleAdmin,
		})
		response, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, response.StatusCode)
		require.NoError(t, response.Body.Close())
	})

	input = strings.NewReader(testPatchUserPreferencesCmdBad)
	t.Run("Returns 400 with bad data", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(server.NewRequest(http.MethodPatch, patchUserPreferencesUrl, input), &user.SignedInUser{
			OrgID:   1,
			OrgRole: org.RoleAdmin,
		})
		response, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, response.StatusCode)
		require.NoError(t, response.Body.Close())
	})

	input = strings.NewReader(testUpdateOrgPreferencesWithHomeDashboardUIDCmd)
	t.Run("Returns 200 on success", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(server.NewRequest(http.MethodPatch, patchUserPreferencesUrl, input), &user.SignedInUser{
			OrgID:   1,
			OrgRole: org.RoleAdmin,
		})
		response, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, response.StatusCode)
		require.NoError(t, response.Body.Close())
	})
}

func TestAPIEndpoint_PatchOrgPreferences(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false

	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = cfg
		hs.preferenceService = preftest.NewPreferenceServiceFake()
	})

	input := strings.NewReader(testPatchOrgPreferencesCmd)
	t.Run("Returns 200 on success", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(server.NewRequest(http.MethodPatch, patchOrgPreferencesUrl, input), &user.SignedInUser{
			OrgID:   1,
			OrgRole: org.RoleAdmin,
		})
		response, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, response.StatusCode)
		require.NoError(t, response.Body.Close())
	})

	input = strings.NewReader(testPatchOrgPreferencesCmdBad)
	t.Run("Returns 400 with bad data", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(server.NewRequest(http.MethodPatch, patchOrgPreferencesUrl, input), &user.SignedInUser{
			OrgID:   1,
			OrgRole: org.RoleAdmin,
		})
		response, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, response.StatusCode)
		require.NoError(t, response.Body.Close())
	})
}

package api

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/preference/preftest"
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
	sc := setupHTTPServer(t, true, false)
	dashSvc := dashboards.NewFakeDashboardService(t)
	dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Run(func(args mock.Arguments) {
		q := args.Get(1).(*models.GetDashboardQuery)
		q.Result = &models.Dashboard{Uid: "home", Id: 1}
	}).Return(nil)

	sc.hs.dashboardService = dashSvc

	prefService := preftest.NewPreferenceServiceFake()
	prefService.ExpectedPreference = &pref.Preference{HomeDashboardID: 1, Theme: "dark"}
	sc.hs.preferenceService = prefService

	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	setInitCtxSignedInViewer(sc.initCtx)
	t.Run("Viewer cannot get org preferences", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, getOrgPreferencesURL, nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	setInitCtxSignedInOrgAdmin(sc.initCtx)
	t.Run("Org Admin can get org preferences", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, getOrgPreferencesURL, nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
		var resp map[string]interface{}
		b, err := ioutil.ReadAll(response.Body)
		assert.NoError(t, err)
		assert.NoError(t, json.Unmarshal(b, &resp))
		assert.Equal(t, "home", resp["homeDashboardUID"])
	})
}

func TestAPIEndpoint_GetCurrentOrgPreferences_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true, true)
	setInitCtxSignedInViewer(sc.initCtx)

	prefService := preftest.NewPreferenceServiceFake()
	prefService.ExpectedPreference = &pref.Preference{HomeDashboardID: 1, Theme: "dark"}
	sc.hs.preferenceService = prefService

	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	t.Run("AccessControl allows getting org preferences with correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionOrgsPreferencesRead}}, sc.initCtx.OrgId)
		response := callAPI(sc.server, http.MethodGet, getOrgPreferencesURL, nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
	t.Run("AccessControl prevents getting org preferences with correct permissions in another org", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionOrgsPreferencesRead}}, 2)
		response := callAPI(sc.server, http.MethodGet, getOrgPreferencesURL, nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
	t.Run("AccessControl prevents getting org preferences with incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: "orgs:invalid"}}, sc.initCtx.OrgId)
		response := callAPI(sc.server, http.MethodGet, getOrgPreferencesURL, nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestAPIEndpoint_PutCurrentOrgPreferences_LegacyAccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true, false)

	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	setInitCtxSignedInViewer(sc.initCtx)
	input := strings.NewReader(testUpdateOrgPreferencesCmd)
	t.Run("Viewer cannot update org preferences", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPut, putOrgPreferencesURL, input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	setInitCtxSignedInOrgAdmin(sc.initCtx)
	input = strings.NewReader(testUpdateOrgPreferencesCmd)
	t.Run("Org Admin can update org preferences", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPut, putOrgPreferencesURL, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_PutCurrentOrgPreferences_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true, true)
	setInitCtxSignedInViewer(sc.initCtx)

	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	input := strings.NewReader(testUpdateOrgPreferencesCmd)
	t.Run("AccessControl allows updating org preferences with correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionOrgsPreferencesWrite}}, sc.initCtx.OrgId)
		response := callAPI(sc.server, http.MethodPut, putOrgPreferencesURL, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	input = strings.NewReader(testUpdateOrgPreferencesCmd)
	t.Run("AccessControl prevents updating org preferences with correct permissions in another org", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionOrgsPreferencesWrite}}, 2)
		response := callAPI(sc.server, http.MethodPut, putOrgPreferencesURL, input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	input = strings.NewReader(testUpdateOrgPreferencesCmd)
	t.Run("AccessControl prevents updating org preferences with incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: "orgs:invalid"}}, sc.initCtx.OrgId)
		response := callAPI(sc.server, http.MethodPut, putOrgPreferencesURL, input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestAPIEndpoint_PatchUserPreferences(t *testing.T) {
	sc := setupHTTPServer(t, true, false)

	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	setInitCtxSignedInOrgAdmin(sc.initCtx)
	input := strings.NewReader(testPatchUserPreferencesCmd)
	t.Run("Returns 200 on success", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPatch, patchUserPreferencesUrl, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	input = strings.NewReader(testPatchUserPreferencesCmdBad)
	t.Run("Returns 400 with bad data", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPut, patchUserPreferencesUrl, input, t)
		assert.Equal(t, http.StatusBadRequest, response.Code)
	})
	input = strings.NewReader(testUpdateOrgPreferencesWithHomeDashboardUIDCmd)
	dashSvc := dashboards.NewFakeDashboardService(t)
	dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Run(func(args mock.Arguments) {
		q := args.Get(1).(*models.GetDashboardQuery)
		q.Result = &models.Dashboard{Uid: "home", Id: 1}
	}).Return(nil)
	sc.hs.dashboardService = dashSvc
	t.Run("Returns 200 on success", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPatch, patchUserPreferencesUrl, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_PatchOrgPreferences(t *testing.T) {
	sc := setupHTTPServer(t, true, false)

	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	setInitCtxSignedInOrgAdmin(sc.initCtx)
	input := strings.NewReader(testPatchOrgPreferencesCmd)
	t.Run("Returns 200 on success", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPatch, patchOrgPreferencesUrl, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	input = strings.NewReader(testPatchOrgPreferencesCmdBad)
	t.Run("Returns 400 with bad data", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPut, patchOrgPreferencesUrl, input, t)
		assert.Equal(t, http.StatusBadRequest, response.Code)
	})
}

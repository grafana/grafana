package api

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
)

var getCurrentOrgQuotasURL = "/api/org/quotas"
var getOrgsQuotasURL = "/api/orgs/%v/quotas"

var testOrgQuota = setting.OrgQuota{
	User:       10,
	DataSource: 10,
	Dashboard:  10,
	ApiKey:     10,
	AlertRule:  10,
}

func TestAPIEndpoint_GetCurrentOrgQuotas_LegacyAccessControl(t *testing.T) {
	sc := setupHTTPServer(t, false)
	setInitCtxSignedInViewer(sc.initCtx)

	sc.hs.Cfg.Quota.Enabled = true
	sc.hs.Cfg.Quota.Org = &testOrgQuota
	// Required while sqlstore quota.go relies on setting global variables
	setting.Quota = sc.hs.Cfg.Quota

	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	t.Run("Viewer can view CurrentOrgQuotas", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, getCurrentOrgQuotasURL, nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	sc.initCtx.IsSignedIn = false
	t.Run("Unsigned user cannot view CurrentOrgQuotas", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, getCurrentOrgQuotasURL, nil, t)
		assert.Equal(t, http.StatusUnauthorized, response.Code)
	})
}

func TestAPIEndpoint_GetCurrentOrgQuotas_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true)
	setInitCtxSignedInViewer(sc.initCtx)

	sc.hs.Cfg.Quota.Enabled = true
	sc.hs.Cfg.Quota.Org = &testOrgQuota
	// Required while sqlstore quota.go relies on setting global variables
	setting.Quota = sc.hs.Cfg.Quota

	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	t.Run("AccessControl allows viewing CurrentOrgQuotas with correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionOrgsQuotasRead, Scope: ScopeOrgsAll}})
		response := callAPI(sc.server, http.MethodGet, getCurrentOrgQuotasURL, nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
	t.Run("AccessControl allows viewing CurrentOrgQuotas with exact permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionOrgsQuotasRead, Scope: accesscontrol.Scope("orgs", "id", "1")}})
		response := callAPI(sc.server, http.MethodGet, getCurrentOrgQuotasURL, nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
	t.Run("AccessControl prevents viewing CurrentOrgQuotas with incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: "orgs:invalid"}})
		response := callAPI(sc.server, http.MethodGet, getCurrentOrgQuotasURL, nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestAPIEndpoint_GetOrgQuotas_LegacyAccessControl(t *testing.T) {
	sc := setupHTTPServer(t, false)
	setInitCtxSignedInViewer(sc.initCtx)

	sc.hs.Cfg.Quota.Enabled = true
	sc.hs.Cfg.Quota.Org = &testOrgQuota
	// Required while sqlstore quota.go relies on setting global variables
	setting.Quota = sc.hs.Cfg.Quota

	// Create two orgs, to fetch another one than the logged in one
	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)
	_, err = sc.db.CreateOrgWithMember("TestOrg2", testUserID)
	require.NoError(t, err)

	t.Run("Viewer cannot view another org quotas", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsQuotasURL, 2), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	sc.initCtx.SignedInUser.IsGrafanaAdmin = true
	t.Run("Grafana admin viewer can view another org quotas", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsQuotasURL, 2), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_GetOrgQuotas_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true)
	setInitCtxSignedInViewer(sc.initCtx)

	sc.hs.Cfg.Quota.Enabled = true
	sc.hs.Cfg.Quota.Org = &testOrgQuota
	// Required while sqlstore quota.go relies on setting global variables
	setting.Quota = sc.hs.Cfg.Quota

	// Create two orgs, to fetch another one than the logged in one
	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)
	_, err = sc.db.CreateOrgWithMember("TestOrg2", testUserID)
	require.NoError(t, err)

	t.Run("AccessControl allows viewing another org quotas with correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionOrgsQuotasRead, Scope: ScopeOrgsAll}})
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsQuotasURL, 2), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
	t.Run("AccessControl allows viewing another org quotas with exact permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionOrgsQuotasRead, Scope: accesscontrol.Scope("orgs", "id", "2")}})
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsQuotasURL, 2), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
	t.Run("AccessControl prevents viewing another org quotas with too narrow permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionOrgsQuotasRead, Scope: accesscontrol.Scope("orgs", "id", "1")}})
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsQuotasURL, 2), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
	t.Run("AccessControl prevents viewing another org quotas with incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: "orgs:invalid"}})
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsQuotasURL, 2), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

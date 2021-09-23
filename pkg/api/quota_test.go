package api

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
)

var getCurrentOrgQuotasUrl = "/api/org/quotas"
var getOrgsQuotasUrl = "/api/orgs/%v/quotas"

var testOrgQuota = setting.OrgQuota{
	User:       10,
	DataSource: 10,
	Dashboard:  10,
	ApiKey:     10,
	AlertRule:  10,
}

func TestAPIEndpoint_GetCurrentOrgQuotas_LegacyAccessControl(t *testing.T) {
	testuser := &models.SignedInUser{UserId: testUserID, OrgId: 1, OrgRole: models.ROLE_VIEWER, Login: testUserLogin}
	server, hs, _ := setupHTTPServer(t, false, testuser)

	hs.Cfg.Quota.Enabled = true
	hs.Cfg.Quota.Org = &testOrgQuota
	// Required while sqlstore quota.go relies on setting global variables
	setting.Quota = hs.Cfg.Quota

	_, err := hs.SQLStore.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	t.Run("Viewer can view CurrentOrgQuotas", func(t *testing.T) {
		response := callAPI(server, http.MethodGet, getCurrentOrgQuotasUrl, nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_GetCurrentOrgQuotas_AccessControl(t *testing.T) {
	testuser := &models.SignedInUser{UserId: testUserID, OrgId: 1, OrgRole: models.ROLE_VIEWER, Login: testUserLogin}
	server, hs, acmock := setupHTTPServer(t, true, testuser)

	hs.Cfg.Quota.Enabled = true
	hs.Cfg.Quota.Org = &testOrgQuota
	// Required while sqlstore quota.go relies on setting global variables
	setting.Quota = hs.Cfg.Quota

	_, err := hs.SQLStore.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	t.Run("AccessControl allows viewing CurrentOrgQuotas with correct permissions", func(t *testing.T) {
		setAccessControlPermissions(acmock, []*accesscontrol.Permission{{Action: ActionOrgsRead, Scope: ScopeOrgsAll}})
		response := callAPI(server, http.MethodGet, getCurrentOrgQuotasUrl, nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
	t.Run("AccessControl allows viewing CurrentOrgQuotas with exact permissions", func(t *testing.T) {
		setAccessControlPermissions(acmock, []*accesscontrol.Permission{{Action: ActionOrgsRead, Scope: accesscontrol.Scope("orgs", "1")}})
		response := callAPI(server, http.MethodGet, getCurrentOrgQuotasUrl, nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
	t.Run("AccessControl prevents viewing CurrentOrgQuotas with incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(acmock, []*accesscontrol.Permission{{Action: "orgs:invalid"}})
		response := callAPI(server, http.MethodGet, getCurrentOrgQuotasUrl, nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestAPIEndpoint_GetOrgQuotas_LegacyAccessControl(t *testing.T) {
	testuser := &models.SignedInUser{UserId: testUserID, OrgId: 1, OrgRole: models.ROLE_ADMIN, Login: testUserLogin, IsGrafanaAdmin: true}
	server, hs, _ := setupHTTPServer(t, false, testuser)

	hs.Cfg.Quota.Enabled = true
	hs.Cfg.Quota.Org = &testOrgQuota
	// Required while sqlstore quota.go relies on setting global variables
	setting.Quota = hs.Cfg.Quota

	// Create two orgs, to fetch another one than the logged in one
	_, err := hs.SQLStore.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)
	_, err = hs.SQLStore.CreateOrgWithMember("TestOrg2", testUserID)
	require.NoError(t, err)

	t.Run("Admin can view another org quotas", func(t *testing.T) {
		response := callAPI(server, http.MethodGet, fmt.Sprintf(getOrgsQuotasUrl, 2), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_GetOrgQuotas_AccessControl(t *testing.T) {
	testuser := &models.SignedInUser{UserId: testUserID, OrgId: 1, OrgRole: models.ROLE_VIEWER, Login: testUserLogin}
	server, hs, acmock := setupHTTPServer(t, true, testuser)

	hs.Cfg.Quota.Enabled = true
	hs.Cfg.Quota.Org = &testOrgQuota
	// Required while sqlstore quota.go relies on setting global variables
	setting.Quota = hs.Cfg.Quota

	// Create two orgs, to fetch another one than the logged in one
	_, err := hs.SQLStore.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)
	_, err = hs.SQLStore.CreateOrgWithMember("TestOrg2", testUserID)
	require.NoError(t, err)

	t.Run("AccessControl allows viewing another org quotas with correct permissions", func(t *testing.T) {
		setAccessControlPermissions(acmock, []*accesscontrol.Permission{{Action: ActionOrgsRead, Scope: ScopeOrgsAll}})
		response := callAPI(server, http.MethodGet, fmt.Sprintf(getOrgsQuotasUrl, 2), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
	t.Run("AccessControl prevents viewing another org quotas with too narrow permissions", func(t *testing.T) {
		setAccessControlPermissions(acmock, []*accesscontrol.Permission{{Action: ActionOrgsRead, Scope: accesscontrol.Scope("orgs", "1")}})
		response := callAPI(server, http.MethodGet, fmt.Sprintf(getOrgsQuotasUrl, 2), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
	t.Run("AccessControl prevents viewing another org quotas with incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(acmock, []*accesscontrol.Permission{{Action: "orgs:invalid"}})
		response := callAPI(server, http.MethodGet, fmt.Sprintf(getOrgsQuotasUrl, 2), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

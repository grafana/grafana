package api

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	searchOrgsURL           = "/api/orgs/"
	getCurrentOrgURL        = "/api/org/"
	getOrgsURL              = "/api/orgs/%v"
	getOrgsByNameURL        = "/api/orgs/name/%v"
	putCurrentOrgURL        = "/api/org/"
	putOrgsURL              = "/api/orgs/%v"
	putCurrentOrgAddressURL = "/api/org/address"
	putOrgsAddressURL       = "/api/orgs/%v/address"

	testUpdateOrgNameForm    = `{ "name": "TestOrgChanged" }`
	testUpdateOrgAddressForm = `{ "address1": "1 test road",
	"address2": "2 test road",
	"city": "TestCity",
	"ZipCode": "TESTZIPCODE",
	"State": "TestState",
	"Country": "TestCountry" }`

	deleteOrgsURL = "/api/orgs/%v"

	createOrgsURL    = "/api/orgs/"
	testCreateOrgCmd = `{ "name": "TestOrg%v"}`
)

// `/api/org` endpoints test

func TestAPIEndpoint_GetCurrentOrg_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInViewer(sc.initCtx)

	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	t.Run("Viewer can view CurrentOrg", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, getCurrentOrgURL, nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	sc.initCtx.IsSignedIn = false
	t.Run("Unsigned user cannot view CurrentOrg", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, getCurrentOrgURL, nil, t)
		assert.Equal(t, http.StatusUnauthorized, response.Code)
	})
}

func TestAPIEndpoint_GetCurrentOrg_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true)
	setInitCtxSignedInViewer(sc.initCtx)

	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	t.Run("AccessControl allows viewing CurrentOrg with correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsRead}}, sc.initCtx.OrgID)
		response := callAPI(sc.server, http.MethodGet, getCurrentOrgURL, nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
	t.Run("AccessControl prevents viewing CurrentOrg with correct permissions in another org", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsRead}}, 2)
		response := callAPI(sc.server, http.MethodGet, getCurrentOrgURL, nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
	t.Run("AccessControl prevents viewing CurrentOrg with incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: "orgs:invalid"}}, sc.initCtx.OrgID)
		response := callAPI(sc.server, http.MethodGet, getCurrentOrgURL, nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestAPIEndpoint_PutCurrentOrg_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)

	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	input := strings.NewReader(testUpdateOrgNameForm)

	setInitCtxSignedInViewer(sc.initCtx)
	t.Run("Viewer cannot update current org", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPut, putCurrentOrgURL, input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	setInitCtxSignedInOrgAdmin(sc.initCtx)
	sc.hs.orgService = orgimpl.ProvideService(sc.db, sc.cfg)
	t.Run("Admin can update current org", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPut, putCurrentOrgURL, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_PutCurrentOrg_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true)
	setInitCtxSignedInViewer(sc.initCtx)

	_, err := sc.db.CreateOrgWithMember("TestOrg", sc.initCtx.UserID)
	require.NoError(t, err)

	sc.hs.orgService = orgimpl.ProvideService(sc.db, sc.cfg)

	input := strings.NewReader(testUpdateOrgNameForm)
	t.Run("AccessControl allows updating current org with correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsWrite}}, sc.initCtx.OrgID)
		response := callAPI(sc.server, http.MethodPut, putCurrentOrgURL, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	t.Run("AccessControl prevents updating current org with correct permissions in another org", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsWrite}}, 2)
		response := callAPI(sc.server, http.MethodPut, putCurrentOrgURL, input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	t.Run("AccessControl prevents updating current org with incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: "orgs:invalid"}}, sc.initCtx.OrgID)
		response := callAPI(sc.server, http.MethodPut, putCurrentOrgURL, input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestAPIEndpoint_PutCurrentOrgAddress_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)

	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	input := strings.NewReader(testUpdateOrgAddressForm)

	setInitCtxSignedInViewer(sc.initCtx)
	t.Run("Viewer cannot update current org address", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPut, putCurrentOrgAddressURL, input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	setInitCtxSignedInOrgAdmin(sc.initCtx)
	t.Run("Admin can update current org address", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPut, putCurrentOrgAddressURL, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_PutCurrentOrgAddress_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true)
	setInitCtxSignedInViewer(sc.initCtx)

	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	input := strings.NewReader(testUpdateOrgAddressForm)
	t.Run("AccessControl allows updating current org address with correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsWrite}}, sc.initCtx.OrgID)
		response := callAPI(sc.server, http.MethodPut, putCurrentOrgAddressURL, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	input = strings.NewReader(testUpdateOrgAddressForm)
	t.Run("AccessControl prevents updating current org address with correct permissions in another org", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsWrite}}, 2)
		response := callAPI(sc.server, http.MethodPut, putCurrentOrgAddressURL, input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	t.Run("AccessControl prevents updating current org address with incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: "orgs:invalid"}}, sc.initCtx.OrgID)
		response := callAPI(sc.server, http.MethodPut, putCurrentOrgAddressURL, input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

// `/api/orgs/` endpoints test

// setupOrgsDBForAccessControlTests creates orgs up until orgID and fake user as member of org
func setupOrgsDBForAccessControlTests(t *testing.T, db sqlstore.Store, c accessControlScenarioContext, orgID int64) {
	t.Helper()
	setInitCtxSignedInViewer(c.initCtx)
	u := *c.initCtx.SignedInUser
	u.OrgID = orgID
	c.usermock.ExpectedSignedInUser = &u

	// Create `orgsCount` orgs
	for i := 1; i <= int(orgID); i++ {
		_, err := db.CreateOrgWithMember(fmt.Sprintf("TestOrg%v", i), 0)
		require.NoError(t, err)
	}
}

func TestAPIEndpoint_CreateOrgs_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInViewer(sc.initCtx)

	setting.AllowUserOrgCreate = false
	input := strings.NewReader(fmt.Sprintf(testCreateOrgCmd, 2))
	t.Run("Viewer cannot create Orgs", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPost, createOrgsURL, input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	sc.initCtx.SignedInUser.IsGrafanaAdmin = true
	input = strings.NewReader(fmt.Sprintf(testCreateOrgCmd, 3))
	t.Run("Grafana Admin viewer can create Orgs", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPost, createOrgsURL, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	sc.initCtx.SignedInUser.IsGrafanaAdmin = false
	setting.AllowUserOrgCreate = true
	input = strings.NewReader(fmt.Sprintf(testCreateOrgCmd, 4))
	t.Run("User viewer can create Orgs when AllowUserOrgCreate setting is true", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPost, createOrgsURL, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_CreateOrgs_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true)
	setInitCtxSignedInViewer(sc.initCtx)

	setupOrgsDBForAccessControlTests(t, sc.db, sc, 0)

	input := strings.NewReader(fmt.Sprintf(testCreateOrgCmd, 2))
	t.Run("AccessControl allows creating Orgs with correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsCreate}}, accesscontrol.GlobalOrgID)
		response := callAPI(sc.server, http.MethodPost, createOrgsURL, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	input = strings.NewReader(fmt.Sprintf(testCreateOrgCmd, 3))
	t.Run("AccessControl prevents creating Orgs with incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: "orgs:invalid"}}, accesscontrol.GlobalOrgID)
		response := callAPI(sc.server, http.MethodPost, createOrgsURL, input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestAPIEndpoint_DeleteOrgs_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInViewer(sc.initCtx)

	setupOrgsDBForAccessControlTests(t, sc.db, sc, 2)

	t.Run("Viewer cannot delete Orgs", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(deleteOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	sc.initCtx.SignedInUser.IsGrafanaAdmin = true
	t.Run("Grafana Admin viewer can delete Orgs", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(deleteOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_DeleteOrgs_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true)
	setupOrgsDBForAccessControlTests(t, sc.db, sc, 2)

	t.Run("AccessControl prevents deleting Orgs with incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: "orgs:invalid"}}, 2)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(deleteOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
	t.Run("AccessControl prevents deleting Orgs with correct permissions in another org", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsDelete}}, 1)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(deleteOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
	t.Run("AccessControl allows deleting Orgs with correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsDelete}}, 2)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(deleteOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_SearchOrgs_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInViewer(sc.initCtx)

	t.Run("Viewer cannot list Orgs", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, searchOrgsURL, nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	sc.initCtx.SignedInUser.IsGrafanaAdmin = true
	t.Run("Grafana Admin viewer can list Orgs", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, searchOrgsURL, nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_SearchOrgs_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true)
	setInitCtxSignedInViewer(sc.initCtx)

	t.Run("AccessControl allows listing Orgs with correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsRead}}, accesscontrol.GlobalOrgID)
		response := callAPI(sc.server, http.MethodGet, searchOrgsURL, nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
	t.Run("AccessControl prevents listing Orgs with correct permissions not granted globally", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsRead}}, 1)
		response := callAPI(sc.server, http.MethodGet, searchOrgsURL, nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
	t.Run("AccessControl prevents listing Orgs with incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: "orgs:invalid"}}, accesscontrol.GlobalOrgID)
		response := callAPI(sc.server, http.MethodGet, searchOrgsURL, nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestAPIEndpoint_GetOrg_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInViewer(sc.initCtx)

	// Create two orgs, to fetch another one than the logged in one
	setupOrgsDBForAccessControlTests(t, sc.db, sc, 2)

	t.Run("Viewer cannot view another Org", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	sc.initCtx.SignedInUser.IsGrafanaAdmin = true
	t.Run("Grafana admin viewer can view another Org", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_GetOrg_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true)
	setInitCtxSignedInViewer(sc.initCtx)

	// Create two orgs, to fetch another one than the logged in one
	setupOrgsDBForAccessControlTests(t, sc.db, sc, 2)

	t.Run("AccessControl allows viewing another org with correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsRead}}, 2)
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
	t.Run("AccessControl prevents viewing another org with correct permissions in another org", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsRead}}, 1)
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
	t.Run("AccessControl prevents viewing another org with incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: "orgs:invalid"}}, 2)
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsURL, 2), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestAPIEndpoint_GetOrgByName_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInViewer(sc.initCtx)

	// Create two orgs, to fetch another one than the logged in one
	setupOrgsDBForAccessControlTests(t, sc.db, sc, 2)

	t.Run("Viewer cannot view another Org", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsByNameURL, "TestOrg2"), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	sc.initCtx.SignedInUser.IsGrafanaAdmin = true
	t.Run("Grafana admin viewer can view another Org", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsByNameURL, "TestOrg2"), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_GetOrgByName_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true)
	setInitCtxSignedInViewer(sc.initCtx)

	// Create two orgs, to fetch another one than the logged in one
	setupOrgsDBForAccessControlTests(t, sc.db, sc, 2)

	t.Run("AccessControl allows viewing another org with correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsRead}}, accesscontrol.GlobalOrgID)
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsByNameURL, "TestOrg2"), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
	t.Run("AccessControl prevents viewing another org with incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: "orgs:invalid"}}, accesscontrol.GlobalOrgID)
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(getOrgsByNameURL, "TestOrg2"), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestAPIEndpoint_PutOrg_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInViewer(sc.initCtx)
	sc.hs.orgService = orgimpl.ProvideService(sc.db, sc.cfg)
	// Create two orgs, to update another one than the logged in one
	setupOrgsDBForAccessControlTests(t, sc.db, sc, 2)

	input := strings.NewReader(testUpdateOrgNameForm)

	t.Run("Viewer cannot update another org", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(putOrgsURL, 2), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	sc.initCtx.SignedInUser.IsGrafanaAdmin = true
	t.Run("Grafana Admin can update another org", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(putOrgsURL, 2), input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_PutOrg_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true)
	setInitCtxSignedInViewer(sc.initCtx)
	sc.hs.orgService = orgimpl.ProvideService(sc.db, sc.cfg)
	// Create two orgs, to update another one than the logged in one
	setupOrgsDBForAccessControlTests(t, sc.db, sc, 2)

	input := strings.NewReader(testUpdateOrgNameForm)
	t.Run("AccessControl allows updating another org with correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsWrite}}, 2)
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(putOrgsURL, 2), input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	t.Run("AccessControl prevents updating another org with correct permissions in another org", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsWrite}}, 1)
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(putOrgsURL, 2), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	t.Run("AccessControl prevents updating another org with incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: "orgs:invalid"}}, 2)
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(putOrgsURL, 2), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestAPIEndpoint_PutOrgAddress_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInViewer(sc.initCtx)

	// Create two orgs, to update another one than the logged in one
	setupOrgsDBForAccessControlTests(t, sc.db, sc, 2)

	input := strings.NewReader(testUpdateOrgAddressForm)

	t.Run("Viewer cannot update another org address", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(putOrgsAddressURL, 2), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	sc.initCtx.SignedInUser.IsGrafanaAdmin = true
	t.Run("Grafana Admin can update another org address", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(putOrgsAddressURL, 2), input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAPIEndpoint_PutOrgAddress_AccessControl(t *testing.T) {
	sc := setupHTTPServer(t, true)
	setInitCtxSignedInViewer(sc.initCtx)

	// Create two orgs, to update another one than the logged in one
	setupOrgsDBForAccessControlTests(t, sc.db, sc, 2)

	input := strings.NewReader(testUpdateOrgAddressForm)
	t.Run("AccessControl allows updating another org address with correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsWrite}}, 2)
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(putOrgsAddressURL, 2), input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	input = strings.NewReader(testUpdateOrgAddressForm)
	t.Run("AccessControl prevents updating another org address with correct permissions in the current org", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: ActionOrgsWrite}}, 1)
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(putOrgsAddressURL, 2), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	t.Run("AccessControl prevents updating another org address with incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: "orgs:invalid"}}, 2)
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(putOrgsAddressURL, 2), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

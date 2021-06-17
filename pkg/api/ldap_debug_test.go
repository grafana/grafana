package api

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/services/accesscontrol"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/multildap"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type LDAPMock struct {
	Results []*models.ExternalUserInfo
}

var userSearchResult *models.ExternalUserInfo
var userSearchConfig ldap.ServerConfig
var userSearchError error
var pingResult []*multildap.ServerStatus
var pingError error

func (m *LDAPMock) Ping() ([]*multildap.ServerStatus, error) {
	return pingResult, pingError
}

func (m *LDAPMock) Login(query *models.LoginUserQuery) (*models.ExternalUserInfo, error) {
	return &models.ExternalUserInfo{}, nil
}

func (m *LDAPMock) Users(logins []string) ([]*models.ExternalUserInfo, error) {
	s := []*models.ExternalUserInfo{}
	return s, nil
}

func (m *LDAPMock) User(login string) (*models.ExternalUserInfo, ldap.ServerConfig, error) {
	return userSearchResult, userSearchConfig, userSearchError
}

// ***
// GetUserFromLDAP tests
// ***

func getUserFromLDAPContext(t *testing.T, requestURL string) *scenarioContext {
	t.Helper()

	sc := setupScenarioContext(t, requestURL)

	origLDAP := setting.LDAPEnabled
	setting.LDAPEnabled = true
	t.Cleanup(func() { setting.LDAPEnabled = origLDAP })

	hs := &HTTPServer{Cfg: setting.NewCfg()}

	sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
		sc.context = c
		return hs.GetUserFromLDAP(c)
	})

	sc.m.Get("/api/admin/ldap/:username", sc.defaultHandler)

	sc.resp = httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, requestURL, nil)
	sc.req = req
	sc.exec()

	return sc
}

func TestGetUserFromLDAPAPIEndpoint_UserNotFound(t *testing.T) {
	getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
		return &ldap.Config{}, nil
	}

	newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
		return &LDAPMock{}
	}

	userSearchResult = nil

	sc := getUserFromLDAPContext(t, "/api/admin/ldap/user-that-does-not-exist")

	require.Equal(t, sc.resp.Code, http.StatusNotFound)
	assert.JSONEq(t, "{\"message\":\"No user was found in the LDAP server(s) with that username\"}", sc.resp.Body.String())
}

func TestGetUserFromLDAPAPIEndpoint_OrgNotfound(t *testing.T) {
	isAdmin := true
	userSearchResult = &models.ExternalUserInfo{
		Name:           "John Doe",
		Email:          "john.doe@example.com",
		Login:          "johndoe",
		Groups:         []string{"cn=admins,ou=groups,dc=grafana,dc=org"},
		OrgRoles:       map[int64]models.RoleType{1: models.ROLE_ADMIN, 2: models.ROLE_VIEWER},
		IsGrafanaAdmin: &isAdmin,
	}

	userSearchConfig = ldap.ServerConfig{
		Attr: ldap.AttributeMap{
			Name:     "ldap-name",
			Surname:  "ldap-surname",
			Email:    "ldap-email",
			Username: "ldap-username",
		},
		Groups: []*ldap.GroupToOrgRole{
			{
				GroupDN: "cn=admins,ou=groups,dc=grafana,dc=org",
				OrgId:   1,
				OrgRole: models.ROLE_ADMIN,
			},
			{
				GroupDN: "cn=admins,ou=groups,dc=grafana,dc=org",
				OrgId:   2,
				OrgRole: models.ROLE_VIEWER,
			},
		},
	}

	mockOrgSearchResult := []*models.OrgDTO{
		{Id: 1, Name: "Main Org."},
	}

	bus.AddHandler("test", func(query *models.SearchOrgsQuery) error {
		query.Result = mockOrgSearchResult
		return nil
	})

	getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
		return &ldap.Config{}, nil
	}

	newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
		return &LDAPMock{}
	}

	sc := getUserFromLDAPContext(t, "/api/admin/ldap/johndoe")

	require.Equal(t, http.StatusBadRequest, sc.resp.Code)

	expected := `
	{
		"error": "unable to find organization with ID '2'",
		"message": "An organization was not found - Please verify your LDAP configuration"
	}
	`
	assert.JSONEq(t, expected, sc.resp.Body.String())
}

func TestGetUserFromLDAPAPIEndpoint(t *testing.T) {
	isAdmin := true
	userSearchResult = &models.ExternalUserInfo{
		Name:           "John Doe",
		Email:          "john.doe@example.com",
		Login:          "johndoe",
		Groups:         []string{"cn=admins,ou=groups,dc=grafana,dc=org", "another-group-not-matched"},
		OrgRoles:       map[int64]models.RoleType{1: models.ROLE_ADMIN},
		IsGrafanaAdmin: &isAdmin,
	}

	userSearchConfig = ldap.ServerConfig{
		Attr: ldap.AttributeMap{
			Name:     "ldap-name",
			Surname:  "ldap-surname",
			Email:    "ldap-email",
			Username: "ldap-username",
		},
		Groups: []*ldap.GroupToOrgRole{
			{
				GroupDN: "cn=admins,ou=groups,dc=grafana,dc=org",
				OrgId:   1,
				OrgRole: models.ROLE_ADMIN,
			},
			{
				GroupDN: "cn=admins2,ou=groups,dc=grafana,dc=org",
				OrgId:   1,
				OrgRole: models.ROLE_ADMIN,
			},
		},
	}

	mockOrgSearchResult := []*models.OrgDTO{
		{Id: 1, Name: "Main Org."},
	}

	bus.AddHandler("test", func(query *models.SearchOrgsQuery) error {
		query.Result = mockOrgSearchResult
		return nil
	})

	getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
		return &ldap.Config{}, nil
	}

	newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
		return &LDAPMock{}
	}

	sc := getUserFromLDAPContext(t, "/api/admin/ldap/johndoe")

	assert.Equal(t, sc.resp.Code, http.StatusOK)

	expected := `
		{
		  "name": {
				"cfgAttrValue": "ldap-name", "ldapValue": "John"
			},
			"surname": {
				"cfgAttrValue": "ldap-surname", "ldapValue": "Doe"
			},
			"email": {
				"cfgAttrValue": "ldap-email", "ldapValue": "john.doe@example.com"
			},
			"login": {
				"cfgAttrValue": "ldap-username", "ldapValue": "johndoe"
			},
			"isGrafanaAdmin": true,
			"isDisabled": false,
			"roles": [
				{ "orgId": 1, "orgRole": "Admin", "orgName": "Main Org.", "groupDN": "cn=admins,ou=groups,dc=grafana,dc=org" },
				{ "orgId": 0, "orgRole": "", "orgName": "", "groupDN": "another-group-not-matched" }
			],
			"teams": null
		}
	`

	assert.JSONEq(t, expected, sc.resp.Body.String())
}

func TestGetUserFromLDAPAPIEndpoint_WithTeamHandler(t *testing.T) {
	isAdmin := true
	userSearchResult = &models.ExternalUserInfo{
		Name:           "John Doe",
		Email:          "john.doe@example.com",
		Login:          "johndoe",
		Groups:         []string{"cn=admins,ou=groups,dc=grafana,dc=org"},
		OrgRoles:       map[int64]models.RoleType{1: models.ROLE_ADMIN},
		IsGrafanaAdmin: &isAdmin,
	}

	userSearchConfig = ldap.ServerConfig{
		Attr: ldap.AttributeMap{
			Name:     "ldap-name",
			Surname:  "ldap-surname",
			Email:    "ldap-email",
			Username: "ldap-username",
		},
		Groups: []*ldap.GroupToOrgRole{
			{
				GroupDN: "cn=admins,ou=groups,dc=grafana,dc=org",
				OrgId:   1,
				OrgRole: models.ROLE_ADMIN,
			},
		},
	}

	mockOrgSearchResult := []*models.OrgDTO{
		{Id: 1, Name: "Main Org."},
	}

	bus.AddHandler("test", func(query *models.SearchOrgsQuery) error {
		query.Result = mockOrgSearchResult
		return nil
	})

	bus.AddHandler("test", func(cmd *models.GetTeamsForLDAPGroupCommand) error {
		cmd.Result = []models.TeamOrgGroupDTO{}
		return nil
	})

	getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
		return &ldap.Config{}, nil
	}

	newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
		return &LDAPMock{}
	}

	sc := getUserFromLDAPContext(t, "/api/admin/ldap/johndoe")

	require.Equal(t, sc.resp.Code, http.StatusOK)

	expected := `
		{
		  "name": {
				"cfgAttrValue": "ldap-name", "ldapValue": "John"
			},
			"surname": {
				"cfgAttrValue": "ldap-surname", "ldapValue": "Doe"
			},
			"email": {
				"cfgAttrValue": "ldap-email", "ldapValue": "john.doe@example.com"
			},
			"login": {
				"cfgAttrValue": "ldap-username", "ldapValue": "johndoe"
			},
			"isGrafanaAdmin": true,
			"isDisabled": false,
			"roles": [
				{ "orgId": 1, "orgRole": "Admin", "orgName": "Main Org.", "groupDN": "cn=admins,ou=groups,dc=grafana,dc=org" }
			],
			"teams": []
		}
	`

	assert.JSONEq(t, expected, sc.resp.Body.String())
}

// ***
// GetLDAPStatus tests
// ***

func getLDAPStatusContext(t *testing.T) *scenarioContext {
	t.Helper()

	requestURL := "/api/admin/ldap/status"
	sc := setupScenarioContext(t, requestURL)

	ldap := setting.LDAPEnabled
	setting.LDAPEnabled = true
	t.Cleanup(func() { setting.LDAPEnabled = ldap })

	hs := &HTTPServer{Cfg: setting.NewCfg()}

	sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
		sc.context = c
		return hs.GetLDAPStatus(c)
	})

	sc.m.Get("/api/admin/ldap/status", sc.defaultHandler)

	sc.resp = httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, requestURL, nil)
	sc.req = req
	sc.exec()

	return sc
}

func TestGetLDAPStatusAPIEndpoint(t *testing.T) {
	pingResult = []*multildap.ServerStatus{
		{Host: "10.0.0.3", Port: 361, Available: true, Error: nil},
		{Host: "10.0.0.3", Port: 362, Available: true, Error: nil},
		{Host: "10.0.0.5", Port: 361, Available: false, Error: errors.New("something is awfully wrong")},
	}

	getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
		return &ldap.Config{}, nil
	}

	newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
		return &LDAPMock{}
	}

	sc := getLDAPStatusContext(t)

	require.Equal(t, http.StatusOK, sc.resp.Code)

	expected := `
	[
		{ "host": "10.0.0.3", "port": 361, "available": true, "error": "" },
		{ "host": "10.0.0.3", "port": 362, "available": true, "error": "" },
		{ "host": "10.0.0.5", "port": 361, "available": false, "error": "something is awfully wrong" }
	]
	`
	assert.JSONEq(t, expected, sc.resp.Body.String())
}

// ***
// PostSyncUserWithLDAP tests
// ***

func postSyncUserWithLDAPContext(t *testing.T, requestURL string, preHook func(*testing.T, *scenarioContext)) *scenarioContext {
	t.Helper()

	sc := setupScenarioContext(t, requestURL)

	ldap := setting.LDAPEnabled
	t.Cleanup(func() {
		setting.LDAPEnabled = ldap
	})
	setting.LDAPEnabled = true

	hs := &HTTPServer{
		Cfg:              sc.cfg,
		AuthTokenService: auth.NewFakeUserAuthTokenService(),
	}

	sc.defaultHandler = routing.Wrap(func(c *models.ReqContext) response.Response {
		sc.context = c
		return hs.PostSyncUserWithLDAP(c)
	})

	sc.m.Post("/api/admin/ldap/sync/:id", sc.defaultHandler)

	sc.resp = httptest.NewRecorder()
	req, err := http.NewRequest(http.MethodPost, requestURL, nil)
	require.NoError(t, err)

	preHook(t, sc)

	sc.req = req
	sc.exec()

	return sc
}

func TestPostSyncUserWithLDAPAPIEndpoint_Success(t *testing.T) {
	sc := postSyncUserWithLDAPContext(t, "/api/admin/ldap/sync/34", func(t *testing.T, sc *scenarioContext) {
		getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
			return &ldap.Config{}, nil
		}

		newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
			return &LDAPMock{}
		}

		userSearchResult = &models.ExternalUserInfo{
			Login: "ldap-daniel",
		}

		bus.AddHandler("test", func(cmd *models.UpsertUserCommand) error {
			require.Equal(t, "ldap-daniel", cmd.ExternalUser.Login)
			return nil
		})

		bus.AddHandler("test", func(q *models.GetUserByIdQuery) error {
			require.Equal(t, q.Id, int64(34))

			q.Result = &models.User{Login: "ldap-daniel", Id: 34}
			return nil
		})

		bus.AddHandler("test", func(q *models.GetAuthInfoQuery) error {
			require.Equal(t, q.UserId, int64(34))
			require.Equal(t, q.AuthModule, models.AuthModuleLDAP)

			return nil
		})
	})

	assert.Equal(t, http.StatusOK, sc.resp.Code)

	expected := `
	{
		"message": "User synced successfully"
	}
	`

	assert.JSONEq(t, expected, sc.resp.Body.String())
}

func TestPostSyncUserWithLDAPAPIEndpoint_WhenUserNotFound(t *testing.T) {
	sc := postSyncUserWithLDAPContext(t, "/api/admin/ldap/sync/34", func(t *testing.T, sc *scenarioContext) {
		getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
			return &ldap.Config{}, nil
		}

		newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
			return &LDAPMock{}
		}

		bus.AddHandler("test", func(q *models.GetUserByIdQuery) error {
			require.Equal(t, q.Id, int64(34))

			return models.ErrUserNotFound
		})
	})

	assert.Equal(t, http.StatusNotFound, sc.resp.Code)

	expected := `
	{
		"message": "user not found"
	}
	`

	assert.JSONEq(t, expected, sc.resp.Body.String())
}

func TestPostSyncUserWithLDAPAPIEndpoint_WhenGrafanaAdmin(t *testing.T) {
	sc := postSyncUserWithLDAPContext(t, "/api/admin/ldap/sync/34", func(t *testing.T, sc *scenarioContext) {
		getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
			return &ldap.Config{}, nil
		}

		newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
			return &LDAPMock{}
		}

		userSearchError = multildap.ErrDidNotFindUser

		sc.cfg.AdminUser = "ldap-daniel"

		bus.AddHandler("test", func(q *models.GetUserByIdQuery) error {
			require.Equal(t, q.Id, int64(34))

			q.Result = &models.User{Login: "ldap-daniel", Id: 34}
			return nil
		})

		bus.AddHandler("test", func(q *models.GetAuthInfoQuery) error {
			require.Equal(t, q.UserId, int64(34))
			require.Equal(t, q.AuthModule, models.AuthModuleLDAP)

			return nil
		})
	})

	assert.Equal(t, http.StatusBadRequest, sc.resp.Code)

	expected := `
	{
		"error": "did not find a user",
		"message": "Refusing to sync grafana super admin \"ldap-daniel\" - it would be disabled"
	}
	`

	assert.JSONEq(t, expected, sc.resp.Body.String())
}

func TestPostSyncUserWithLDAPAPIEndpoint_WhenUserNotInLDAP(t *testing.T) {
	sc := postSyncUserWithLDAPContext(t, "/api/admin/ldap/sync/34", func(t *testing.T, sc *scenarioContext) {
		getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
			return &ldap.Config{}, nil
		}

		newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
			return &LDAPMock{}
		}

		userSearchResult = nil

		bus.AddHandler("test", func(cmd *models.UpsertUserCommand) error {
			require.Equal(t, "ldap-daniel", cmd.ExternalUser.Login)
			return nil
		})

		bus.AddHandler("test", func(q *models.GetUserByIdQuery) error {
			require.Equal(t, q.Id, int64(34))

			q.Result = &models.User{Login: "ldap-daniel", Id: 34}
			return nil
		})

		bus.AddHandler("test", func(q *models.GetExternalUserInfoByLoginQuery) error {
			assert.Equal(t, "ldap-daniel", q.LoginOrEmail)
			q.Result = &models.ExternalUserInfo{IsDisabled: true, UserId: 34}

			return nil
		})

		bus.AddHandler("test", func(cmd *models.DisableUserCommand) error {
			assert.Equal(t, 34, cmd.UserId)
			return nil
		})
	})

	assert.Equal(t, http.StatusBadRequest, sc.resp.Code)

	expected := `
	{
		"message": "User not found in LDAP. Disabled the user without updating information"
	}
	`

	assert.JSONEq(t, expected, sc.resp.Body.String())
}

// ***
// Access control tests for ldap endpoints
// ***

func TestLDAP_AccessControl(t *testing.T) {
	tests := []accessControlTestCase{
		{
			url:          "/api/admin/ldap/reload",
			method:       http.MethodPost,
			desc:         "ReloadLDAPCfg should return 200 for user with correct permissions",
			expectedCode: http.StatusOK,
			permissions: []*accesscontrol.Permission{
				{Action: accesscontrol.ActionLDAPConfigReload},
			},
		},
		{
			url:          "/api/admin/ldap/reload",
			method:       http.MethodPost,
			desc:         "ReloadLDAPCfg should return 403 for user without required permissions",
			expectedCode: http.StatusForbidden,
			permissions: []*accesscontrol.Permission{
				{Action: "wrong"},
			},
		},
		{
			url:          "/api/admin/ldap/status",
			method:       http.MethodGet,
			desc:         "GetLDAPStatus should return 200 for user without required permissions",
			expectedCode: http.StatusOK,
			permissions: []*accesscontrol.Permission{
				{Action: accesscontrol.ActionLDAPStatusRead},
			},
		},
		{
			url:          "/api/admin/ldap/status",
			method:       http.MethodGet,
			desc:         "GetLDAPStatus should return 200 for user without required permissions",
			expectedCode: http.StatusForbidden,
			permissions: []*accesscontrol.Permission{
				{Action: "wrong"},
			},
		},
		{
			url:          "/api/admin/ldap/test",
			method:       http.MethodGet,
			desc:         "GetUserFromLDAP should return 200 for user with required permissions",
			expectedCode: http.StatusOK,
			permissions: []*accesscontrol.Permission{
				{Action: accesscontrol.ActionLDAPUsersRead},
			},
		},
		{
			url:          "/api/admin/ldap/test",
			method:       http.MethodGet,
			desc:         "GetUserFromLDAP should return 403 for user without required permissions",
			expectedCode: http.StatusForbidden,
			permissions: []*accesscontrol.Permission{
				{Action: "wrong"},
			},
		},
		{
			url:          "/api/admin/ldap/sync/test",
			method:       http.MethodPost,
			desc:         "PostSyncUserWithLDAP should return 200 for user without required permissions",
			expectedCode: http.StatusOK,
			permissions: []*accesscontrol.Permission{
				{Action: accesscontrol.ActionLDAPUsersSync},
			},
		},
		{
			url:          "/api/admin/ldap/sync/test",
			method:       http.MethodPost,
			desc:         "PostSyncUserWithLDAP should return 200 for user without required permissions",
			expectedCode: http.StatusForbidden,
			permissions: []*accesscontrol.Permission{
				{Action: "wrong"},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			enabled := setting.LDAPEnabled
			configFile := setting.LDAPConfigFile

			t.Cleanup(func() {
				setting.LDAPEnabled = enabled
				setting.LDAPConfigFile = configFile
			})

			setting.LDAPEnabled = true
			path, err := filepath.Abs("../../conf/ldap.toml")
			assert.NoError(t, err)
			setting.LDAPConfigFile = path

			cfg := setting.NewCfg()
			cfg.LDAPEnabled = true

			sc, _ := setupAccessControlScenarioContext(t, cfg, test.url, test.permissions)
			sc.resp = httptest.NewRecorder()
			sc.req, err = http.NewRequest(test.method, test.url, nil)
			assert.NoError(t, err)

			// Add minimal setup to pass handler
			userSearchResult = &models.ExternalUserInfo{}
			userSearchError = nil
			newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
				return &LDAPMock{}
			}

			bus.AddHandler("test", func(q *models.GetUserByIdQuery) error {
				q.Result = &models.User{}
				return nil
			})

			bus.AddHandler("test", func(q *models.GetAuthInfoQuery) error {
				return nil
			})

			bus.AddHandler("test", func(cmd *models.UpsertUserCommand) error {
				return nil
			})

			sc.exec()
			assert.Equal(t, test.expectedCode, sc.resp.Code)
		})
	}
}

package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/loginservice"
	"github.com/grafana/grafana/pkg/services/login/logintest"
	"github.com/grafana/grafana/pkg/services/multildap"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

type LDAPMock struct {
	Results []*login.ExternalUserInfo
}

var userSearchResult *login.ExternalUserInfo
var userSearchConfig ldap.ServerConfig
var userSearchError error
var pingResult []*multildap.ServerStatus
var pingError error

func (m *LDAPMock) Ping() ([]*multildap.ServerStatus, error) {
	return pingResult, pingError
}

func (m *LDAPMock) Login(query *login.LoginUserQuery) (*login.ExternalUserInfo, error) {
	return &login.ExternalUserInfo{}, nil
}

func (m *LDAPMock) Users(logins []string) ([]*login.ExternalUserInfo, error) {
	s := []*login.ExternalUserInfo{}
	return s, nil
}

func (m *LDAPMock) User(login string) (*login.ExternalUserInfo, ldap.ServerConfig, error) {
	return userSearchResult, userSearchConfig, userSearchError
}

// ***
// GetUserFromLDAP tests
// ***

func getUserFromLDAPContext(t *testing.T, requestURL string, searchOrgRst []*org.OrgDTO) *scenarioContext {
	t.Helper()

	sc := setupScenarioContext(t, requestURL)

	origLDAP := setting.LDAPAuthEnabled
	setting.LDAPAuthEnabled = true
	t.Cleanup(func() { setting.LDAPAuthEnabled = origLDAP })

	hs := &HTTPServer{Cfg: setting.NewCfg(), ldapGroups: ldap.ProvideGroupsService(), orgService: &orgtest.FakeOrgService{ExpectedOrgs: searchOrgRst}}

	sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
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

	sc := getUserFromLDAPContext(t, "/api/admin/ldap/user-that-does-not-exist", []*org.OrgDTO{})

	require.Equal(t, sc.resp.Code, http.StatusNotFound)
	assert.JSONEq(t, "{\"message\":\"No user was found in the LDAP server(s) with that username\"}", sc.resp.Body.String())
}

func TestGetUserFromLDAPAPIEndpoint_OrgNotfound(t *testing.T) {
	isAdmin := true
	userSearchResult = &login.ExternalUserInfo{
		Name:           "John Doe",
		Email:          "john.doe@example.com",
		Login:          "johndoe",
		Groups:         []string{"cn=admins,ou=groups,dc=grafana,dc=org"},
		OrgRoles:       map[int64]org.RoleType{1: org.RoleAdmin, 2: org.RoleViewer},
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
				OrgRole: org.RoleAdmin,
			},
			{
				GroupDN: "cn=admins,ou=groups,dc=grafana,dc=org",
				OrgId:   2,
				OrgRole: org.RoleViewer,
			},
		},
	}

	mockOrgSearchResult := []*org.OrgDTO{
		{ID: 1, Name: "Main Org."},
	}

	getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
		return &ldap.Config{}, nil
	}

	newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
		return &LDAPMock{}
	}

	sc := getUserFromLDAPContext(t, "/api/admin/ldap/johndoe", mockOrgSearchResult)

	require.Equal(t, http.StatusBadRequest, sc.resp.Code)

	var res map[string]interface{}
	err := json.Unmarshal(sc.resp.Body.Bytes(), &res)
	assert.NoError(t, err)
	assert.Equal(t, "unable to find organization with ID '2'", res["error"])
	assert.Equal(t, "An organization was not found - Please verify your LDAP configuration", res["message"])
}

func TestGetUserFromLDAPAPIEndpoint(t *testing.T) {
	isAdmin := true
	userSearchResult = &login.ExternalUserInfo{
		Name:           "John Doe",
		Email:          "john.doe@example.com",
		Login:          "johndoe",
		Groups:         []string{"cn=admins,ou=groups,dc=grafana,dc=org", "another-group-not-matched"},
		OrgRoles:       map[int64]org.RoleType{1: org.RoleAdmin},
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
				OrgRole: org.RoleAdmin,
			},
			{
				GroupDN: "cn=admins2,ou=groups,dc=grafana,dc=org",
				OrgId:   1,
				OrgRole: org.RoleAdmin,
			},
		},
	}

	mockOrgSearchResult := []*org.OrgDTO{
		{ID: 1, Name: "Main Org."},
	}

	getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
		return &ldap.Config{}, nil
	}

	newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
		return &LDAPMock{}
	}

	sc := getUserFromLDAPContext(t, "/api/admin/ldap/johndoe", mockOrgSearchResult)

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
	userSearchResult = &login.ExternalUserInfo{
		Name:           "John Doe",
		Email:          "john.doe@example.com",
		Login:          "johndoe",
		Groups:         []string{"cn=admins,ou=groups,dc=grafana,dc=org"},
		OrgRoles:       map[int64]org.RoleType{1: org.RoleAdmin},
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
				OrgRole: org.RoleAdmin,
			},
		},
	}

	mockOrgSearchResult := []*org.OrgDTO{
		{ID: 1, Name: "Main Org."},
	}

	getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
		return &ldap.Config{}, nil
	}

	newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
		return &LDAPMock{}
	}

	sc := getUserFromLDAPContext(t, "/api/admin/ldap/johndoe", mockOrgSearchResult)

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
			"teams": null
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

	ldap := setting.LDAPAuthEnabled
	setting.LDAPAuthEnabled = true
	t.Cleanup(func() { setting.LDAPAuthEnabled = ldap })

	hs := &HTTPServer{Cfg: setting.NewCfg()}

	sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
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

func postSyncUserWithLDAPContext(t *testing.T, requestURL string, preHook func(*testing.T, *scenarioContext), userService user.Service) *scenarioContext {
	t.Helper()

	sc := setupScenarioContext(t, requestURL)
	sc.authInfoService = &logintest.AuthInfoServiceFake{}

	ldap := setting.LDAPAuthEnabled
	t.Cleanup(func() {
		setting.LDAPAuthEnabled = ldap
	})
	setting.LDAPAuthEnabled = true

	hs := &HTTPServer{
		Cfg:              sc.cfg,
		AuthTokenService: authtest.NewFakeUserAuthTokenService(),
		Login:            loginservice.LoginServiceMock{},
		authInfoService:  sc.authInfoService,
		userService:      userService,
	}

	sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
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
	userServiceMock := usertest.NewUserServiceFake()
	userServiceMock.ExpectedUser = &user.User{Login: "ldap-daniel", ID: 34}
	sc := postSyncUserWithLDAPContext(t, "/api/admin/ldap/sync/34", func(t *testing.T, sc *scenarioContext) {
		getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
			return &ldap.Config{}, nil
		}

		newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
			return &LDAPMock{}
		}

		userSearchResult = &login.ExternalUserInfo{
			Login: "ldap-daniel",
		}
	}, userServiceMock)

	assert.Equal(t, http.StatusOK, sc.resp.Code)

	expected := `
	{
		"message": "User synced successfully"
	}
	`

	assert.JSONEq(t, expected, sc.resp.Body.String())
}

func TestPostSyncUserWithLDAPAPIEndpoint_WhenUserNotFound(t *testing.T) {
	userServiceMock := usertest.NewUserServiceFake()
	userServiceMock.ExpectedError = user.ErrUserNotFound
	sc := postSyncUserWithLDAPContext(t, "/api/admin/ldap/sync/34", func(t *testing.T, sc *scenarioContext) {
		getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
			return &ldap.Config{}, nil
		}

		newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
			return &LDAPMock{}
		}
	}, userServiceMock)

	assert.Equal(t, http.StatusNotFound, sc.resp.Code)

	expected := `
	{
		"message": "user not found"
	}
	`

	assert.JSONEq(t, expected, sc.resp.Body.String())
}

func TestPostSyncUserWithLDAPAPIEndpoint_WhenGrafanaAdmin(t *testing.T) {
	userServiceMock := usertest.NewUserServiceFake()
	userServiceMock.ExpectedUser = &user.User{Login: "ldap-daniel", ID: 34}
	sc := postSyncUserWithLDAPContext(t, "/api/admin/ldap/sync/34", func(t *testing.T, sc *scenarioContext) {
		getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
			return &ldap.Config{}, nil
		}

		newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
			return &LDAPMock{}
		}

		userSearchError = multildap.ErrDidNotFindUser

		sc.cfg.AdminUser = "ldap-daniel"
	}, userServiceMock)
	assert.Equal(t, http.StatusBadRequest, sc.resp.Code)

	var res map[string]interface{}
	err := json.Unmarshal(sc.resp.Body.Bytes(), &res)
	assert.NoError(t, err)
	assert.Equal(t, "did not find a user", res["error"])
	assert.Equal(t, "Refusing to sync grafana super admin \"ldap-daniel\" - it would be disabled", res["message"])
}

func TestPostSyncUserWithLDAPAPIEndpoint_WhenUserNotInLDAP(t *testing.T) {
	userServiceMock := usertest.NewUserServiceFake()
	userServiceMock.ExpectedUser = &user.User{Login: "ldap-daniel", ID: 34}
	sc := postSyncUserWithLDAPContext(t, "/api/admin/ldap/sync/34", func(t *testing.T, sc *scenarioContext) {
		sc.authInfoService.ExpectedExternalUser = &login.ExternalUserInfo{IsDisabled: true, UserId: 34}
		getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
			return &ldap.Config{}, nil
		}

		newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
			return &LDAPMock{}
		}

		userSearchResult = nil
		userSearchError = multildap.ErrDidNotFindUser
	}, userServiceMock)

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
	type testCase struct {
		desc         string
		method       string
		url          string
		expectedCode int
		permissions  []accesscontrol.Permission
	}
	tests := []testCase{
		{
			url:          "/api/admin/ldap/reload",
			method:       http.MethodPost,
			desc:         "ReloadLDAPCfg should return 200 for user with correct permissions",
			expectedCode: http.StatusOK,
			permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionLDAPConfigReload},
			},
		},
		{
			url:          "/api/admin/ldap/reload",
			method:       http.MethodPost,
			desc:         "ReloadLDAPCfg should return 403 for user without required permissions",
			expectedCode: http.StatusForbidden,
			permissions: []accesscontrol.Permission{
				{Action: "wrong"},
			},
		},
		{
			url:          "/api/admin/ldap/status",
			method:       http.MethodGet,
			desc:         "GetLDAPStatus should return 200 for user without required permissions",
			expectedCode: http.StatusOK,
			permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionLDAPStatusRead},
			},
		},
		{
			url:          "/api/admin/ldap/status",
			method:       http.MethodGet,
			desc:         "GetLDAPStatus should return 200 for user without required permissions",
			expectedCode: http.StatusForbidden,
			permissions: []accesscontrol.Permission{
				{Action: "wrong"},
			},
		},
		{
			url:          "/api/admin/ldap/test",
			method:       http.MethodGet,
			desc:         "GetUserFromLDAP should return 200 for user with required permissions",
			expectedCode: http.StatusOK,
			permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionLDAPUsersRead},
			},
		},
		{
			url:          "/api/admin/ldap/test",
			method:       http.MethodGet,
			desc:         "GetUserFromLDAP should return 403 for user without required permissions",
			expectedCode: http.StatusForbidden,
			permissions: []accesscontrol.Permission{
				{Action: "wrong"},
			},
		},
		{
			url:          "/api/admin/ldap/sync/1",
			method:       http.MethodPost,
			desc:         "PostSyncUserWithLDAP should return 200 for user without required permissions",
			expectedCode: http.StatusOK,
			permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionLDAPUsersSync},
			},
		},
		{
			url:          "/api/admin/ldap/sync/1",
			method:       http.MethodPost,
			desc:         "PostSyncUserWithLDAP should return 200 for user without required permissions",
			expectedCode: http.StatusForbidden,
			permissions: []accesscontrol.Permission{
				{Action: "wrong"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			enabled := setting.LDAPAuthEnabled
			configFile := setting.LDAPConfigFile

			t.Cleanup(func() {
				setting.LDAPAuthEnabled = enabled
				setting.LDAPConfigFile = configFile
			})

			setting.LDAPAuthEnabled = true
			path, err := filepath.Abs("../../conf/ldap.toml")
			assert.NoError(t, err)
			setting.LDAPConfigFile = path

			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				cfg := setting.NewCfg()
				cfg.LDAPAuthEnabled = true
				hs.Cfg = cfg
				hs.SQLStore = dbtest.NewFakeDB()
				hs.orgService = orgtest.NewOrgServiceFake()
				hs.userService = &usertest.FakeUserService{ExpectedUser: &user.User{}}
				hs.ldapGroups = &ldap.OSSGroups{}
				hs.Login = &loginservice.LoginServiceMock{}
				hs.authInfoService = &logintest.AuthInfoServiceFake{}
			})
			// Add minimal setup to pass handler
			userSearchResult = &login.ExternalUserInfo{}
			userSearchError = nil
			newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
				return &LDAPMock{}
			}

			res, err := server.Send(webtest.RequestWithSignedInUser(server.NewRequest(tt.method, tt.url, nil), userWithPermissions(1, tt.permissions)))
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

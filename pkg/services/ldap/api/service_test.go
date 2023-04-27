package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/ldap/multildap"
	"github.com/grafana/grafana/pkg/services/ldap/service"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/logintest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

type LDAPMock struct {
	Results          []*login.ExternalUserInfo
	UserSearchResult *login.ExternalUserInfo
	UserSearchConfig ldap.ServerConfig
	UserSearchError  error
}

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
	return m.UserSearchResult, m.UserSearchConfig, m.UserSearchError
}

func setupAPITest(t *testing.T, opts ...func(a *Service)) (*Service, *webtest.Server) {
	t.Helper()
	router := routing.NewRouteRegister()
	cfg := setting.NewCfg()
	cfg.LDAPAuthEnabled = true

	a := ProvideService(cfg,
		router,
		acimpl.ProvideAccessControl(cfg),
		usertest.NewUserServiceFake(),
		&logintest.AuthInfoServiceFake{},
		ldap.ProvideGroupsService(),
		&logintest.LoginServiceFake{},
		&orgtest.FakeOrgService{},
		service.NewLDAPFakeService(),
		authtest.NewFakeUserAuthTokenService(),
		supportbundlestest.NewFakeBundleService(),
	)

	for _, o := range opts {
		o(a)
	}

	server := webtest.NewServer(t, router)

	return a, server
}

func TestGetUserFromLDAPAPIEndpoint_UserNotFound(t *testing.T) {
	_, server := setupAPITest(t, func(a *Service) {
		a.orgService = &orgtest.FakeOrgService{
			ExpectedOrgs: []*org.OrgDTO{},
		}
		a.ldapService = &service.LDAPFakeService{
			ExpectedClient: &LDAPMock{
				UserSearchResult: nil,
			},
			ExpectedConfig: &ldap.Config{},
		}
	})

	req := server.NewGetRequest("/api/admin/ldap/user-that-does-not-exist")
	webtest.RequestWithSignedInUser(req, &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {"ldap.user:read": {"*"}}},
	})

	res, err := server.Send(req)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.NoError(t, err)

	assert.Equal(t, http.StatusNotFound, res.StatusCode)
	bodyBytes, _ := io.ReadAll(res.Body)
	assert.JSONEq(t, "{\"message\":\"No user was found in the LDAP server(s) with that username\"}", string(bodyBytes))
}

func TestGetUserFromLDAPAPIEndpoint_OrgNotfound(t *testing.T) {
	isAdmin := true
	userSearchResult := &login.ExternalUserInfo{
		Name:           "John Doe",
		Email:          "john.doe@example.com",
		Login:          "johndoe",
		Groups:         []string{"cn=admins,ou=groups,dc=grafana,dc=org"},
		OrgRoles:       map[int64]org.RoleType{1: org.RoleAdmin, 2: org.RoleViewer},
		IsGrafanaAdmin: &isAdmin,
	}

	userSearchConfig := ldap.ServerConfig{
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

	_, server := setupAPITest(t, func(a *Service) {
		a.orgService = &orgtest.FakeOrgService{
			ExpectedOrgs: mockOrgSearchResult,
		}
		a.ldapService = &service.LDAPFakeService{
			ExpectedClient: &LDAPMock{
				UserSearchResult: userSearchResult,
				UserSearchConfig: userSearchConfig,
			},
			ExpectedConfig: &ldap.Config{},
		}
	})

	req := server.NewGetRequest("/api/admin/ldap/johndoe")
	webtest.RequestWithSignedInUser(req, &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {"ldap.user:read": {"*"}}},
	})

	res, err := server.Send(req)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.NoError(t, err)

	assert.Equal(t, http.StatusBadRequest, res.StatusCode)
	bodyBytes, _ := io.ReadAll(res.Body)

	var resMap map[string]interface{}
	err = json.Unmarshal(bodyBytes, &resMap)
	assert.NoError(t, err)
	assert.Equal(t, "unable to find organization with ID '2'", resMap["error"])
	assert.Equal(t, "An organization was not found - Please verify your LDAP configuration", resMap["message"])
}

func TestGetUserFromLDAPAPIEndpoint(t *testing.T) {
	isAdmin := true
	userSearchResult := &login.ExternalUserInfo{
		Name:           "John Doe",
		Email:          "john.doe@example.com",
		Login:          "johndoe",
		Groups:         []string{"cn=admins,ou=groups,dc=grafana,dc=org", "another-group-not-matched"},
		OrgRoles:       map[int64]org.RoleType{1: org.RoleAdmin},
		IsGrafanaAdmin: &isAdmin,
	}

	userSearchConfig := ldap.ServerConfig{
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

	_, server := setupAPITest(t, func(a *Service) {
		a.orgService = &orgtest.FakeOrgService{
			ExpectedOrgs: mockOrgSearchResult,
		}
		a.ldapService = &service.LDAPFakeService{
			ExpectedClient: &LDAPMock{
				UserSearchResult: userSearchResult,
				UserSearchConfig: userSearchConfig,
			},
			ExpectedConfig: &ldap.Config{},
		}
	})

	req := server.NewGetRequest("/api/admin/ldap/johndoe")
	webtest.RequestWithSignedInUser(req, &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {"ldap.user:read": {"*"}}},
	})

	res, err := server.Send(req)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.NoError(t, err)

	assert.Equal(t, http.StatusOK, res.StatusCode)

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

	bodyBytes, _ := io.ReadAll(res.Body)
	assert.JSONEq(t, expected, string(bodyBytes))
}

func TestGetUserFromLDAPAPIEndpoint_WithTeamHandler(t *testing.T) {
	isAdmin := true
	userSearchResult := &login.ExternalUserInfo{
		Name:           "John Doe",
		Email:          "john.doe@example.com",
		Login:          "johndoe",
		Groups:         []string{"cn=admins,ou=groups,dc=grafana,dc=org"},
		OrgRoles:       map[int64]org.RoleType{1: org.RoleAdmin},
		IsGrafanaAdmin: &isAdmin,
	}

	userSearchConfig := ldap.ServerConfig{
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

	_, server := setupAPITest(t, func(a *Service) {
		a.orgService = &orgtest.FakeOrgService{
			ExpectedOrgs: mockOrgSearchResult,
		}
		a.ldapService = &service.LDAPFakeService{
			ExpectedClient: &LDAPMock{
				UserSearchResult: userSearchResult,
				UserSearchConfig: userSearchConfig,
			},
			ExpectedConfig: &ldap.Config{},
		}
	})

	req := server.NewGetRequest("/api/admin/ldap/johndoe")
	webtest.RequestWithSignedInUser(req, &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {"ldap.user:read": {"*"}}},
	})

	res, err := server.Send(req)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.NoError(t, err)

	assert.Equal(t, http.StatusOK, res.StatusCode)

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

	bodyBytes, _ := io.ReadAll(res.Body)
	assert.JSONEq(t, expected, string(bodyBytes))
}

func TestGetLDAPStatusAPIEndpoint(t *testing.T) {
	pingResult = []*multildap.ServerStatus{
		{Host: "10.0.0.3", Port: 361, Available: true, Error: nil},
		{Host: "10.0.0.3", Port: 362, Available: true, Error: nil},
		{Host: "10.0.0.5", Port: 361, Available: false, Error: errors.New("something is awfully wrong")},
	}

	_, server := setupAPITest(t, func(a *Service) {
		a.ldapService = &service.LDAPFakeService{
			ExpectedClient: &LDAPMock{},
			ExpectedConfig: &ldap.Config{},
		}
	})

	req := server.NewGetRequest("/api/admin/ldap/status")
	webtest.RequestWithSignedInUser(req, &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {"ldap.status:read": {}}},
	})

	res, err := server.Send(req)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.NoError(t, err)

	assert.Equal(t, http.StatusOK, res.StatusCode)

	expected := `
	[
		{ "host": "10.0.0.3", "port": 361, "available": true, "error": "" },
		{ "host": "10.0.0.3", "port": 362, "available": true, "error": "" },
		{ "host": "10.0.0.5", "port": 361, "available": false, "error": "something is awfully wrong" }
	]
	`

	bodyBytes, _ := io.ReadAll(res.Body)
	assert.JSONEq(t, expected, string(bodyBytes))
}

func TestPostSyncUserWithLDAPAPIEndpoint_Success(t *testing.T) {
	userServiceMock := usertest.NewUserServiceFake()
	userServiceMock.ExpectedUser = &user.User{Login: "ldap-daniel", ID: 34}

	_, server := setupAPITest(t, func(a *Service) {
		a.userService = userServiceMock
		a.ldapService = &service.LDAPFakeService{
			ExpectedClient: &LDAPMock{UserSearchResult: &login.ExternalUserInfo{
				Login: "ldap-daniel",
			}},
			ExpectedConfig: &ldap.Config{},
		}
	})

	req := server.NewPostRequest("/api/admin/ldap/sync/34", nil)
	webtest.RequestWithSignedInUser(req, &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {"ldap.user:sync": {}}},
	})

	res, err := server.Send(req)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.NoError(t, err)

	assert.Equal(t, http.StatusOK, res.StatusCode)

	expected := `
	{
		"message": "User synced successfully"
	}
	`

	bodyBytes, _ := io.ReadAll(res.Body)
	assert.JSONEq(t, expected, string(bodyBytes))
}

func TestPostSyncUserWithLDAPAPIEndpoint_WhenUserNotFound(t *testing.T) {
	userServiceMock := usertest.NewUserServiceFake()
	userServiceMock.ExpectedError = user.ErrUserNotFound

	_, server := setupAPITest(t, func(a *Service) {
		a.userService = userServiceMock
		a.ldapService = &service.LDAPFakeService{
			ExpectedClient: &LDAPMock{},
			ExpectedConfig: &ldap.Config{},
		}
	})

	req := server.NewPostRequest("/api/admin/ldap/sync/34", nil)
	webtest.RequestWithSignedInUser(req, &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {"ldap.user:sync": {}}},
	})

	res, err := server.Send(req)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.NoError(t, err)

	assert.Equal(t, http.StatusNotFound, res.StatusCode)

	expected := `
	{
		"message": "user not found"
	}
	`

	bodyBytes, _ := io.ReadAll(res.Body)
	assert.JSONEq(t, expected, string(bodyBytes))
}

func TestPostSyncUserWithLDAPAPIEndpoint_WhenGrafanaAdmin(t *testing.T) {
	userServiceMock := usertest.NewUserServiceFake()
	userServiceMock.ExpectedUser = &user.User{Login: "ldap-daniel", ID: 34}

	_, server := setupAPITest(t, func(a *Service) {
		a.userService = userServiceMock
		a.cfg.AdminUser = "ldap-daniel"
		a.ldapService = &service.LDAPFakeService{
			ExpectedClient: &LDAPMock{UserSearchError: multildap.ErrDidNotFindUser},
			ExpectedConfig: &ldap.Config{},
		}
	})

	req := server.NewPostRequest("/api/admin/ldap/sync/34", nil)
	webtest.RequestWithSignedInUser(req, &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {"ldap.user:sync": {}}},
	})

	res, err := server.Send(req)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.NoError(t, err)

	assert.Equal(t, http.StatusBadRequest, res.StatusCode)

	bodyBytes, _ := io.ReadAll(res.Body)
	var resMap map[string]interface{}
	err = json.Unmarshal(bodyBytes, &resMap)
	assert.NoError(t, err)
	assert.Equal(t, "did not find a user", resMap["error"])
	assert.Equal(t, "Refusing to sync grafana super admin \"ldap-daniel\" - it would be disabled", resMap["message"])
}

func TestPostSyncUserWithLDAPAPIEndpoint_WhenUserNotInLDAP(t *testing.T) {
	userServiceMock := usertest.NewUserServiceFake()
	userServiceMock.ExpectedUser = &user.User{Login: "ldap-daniel", ID: 34}

	_, server := setupAPITest(t, func(a *Service) {
		a.userService = userServiceMock
		a.authInfoService = &logintest.AuthInfoServiceFake{ExpectedExternalUser: &login.ExternalUserInfo{IsDisabled: true, UserId: 34}}
		a.ldapService = &service.LDAPFakeService{
			ExpectedClient: &LDAPMock{UserSearchError: multildap.ErrDidNotFindUser},
			ExpectedConfig: &ldap.Config{},
		}
	})

	req := server.NewPostRequest("/api/admin/ldap/sync/34", nil)
	webtest.RequestWithSignedInUser(req, &user.SignedInUser{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {"ldap.user:sync": {}}},
	})

	res, err := server.Send(req)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.NoError(t, err)

	assert.Equal(t, http.StatusBadRequest, res.StatusCode)

	expected := `
	{
		"message": "User not found in LDAP. Disabled the user without updating information"
	}
	`

	bodyBytes, _ := io.ReadAll(res.Body)
	assert.JSONEq(t, expected, string(bodyBytes))
}

func TestLDAP_AccessControl(t *testing.T) {
	f, errC := os.CreateTemp("", "ldap.toml")
	require.NoError(t, errC)

	_, errF := f.WriteString(
		`[[servers]]
host = "127.0.0.1"
port = 389
search_filter = "(cn=%s)"
search_base_dns = ["dc=grafana,dc=org"]`)
	require.NoError(t, errF)

	ldapConfigFile := f.Name()

	errF = f.Close()
	require.NoError(t, errF)

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
			_, server := setupAPITest(t, func(a *Service) {
				a.userService = &usertest.FakeUserService{ExpectedUser: &user.User{Login: "ldap-daniel", ID: 1}}
				a.cfg.LDAPConfigFilePath = ldapConfigFile
				a.ldapService = &service.LDAPFakeService{
					ExpectedClient: &LDAPMock{UserSearchResult: &login.ExternalUserInfo{
						Login: "ldap-daniel",
					}},
					ExpectedConfig: &ldap.Config{},
				}
			})
			// Add minimal setup to pass handler
			res, err := server.Send(
				webtest.RequestWithSignedInUser(server.NewRequest(tt.method, tt.url, nil),
					userWithPermissions(1, tt.permissions)))
			require.NoError(t, err)

			bodyBytes, _ := io.ReadAll(res.Body)
			assert.Equal(t, tt.expectedCode, res.StatusCode, string(bodyBytes))
			require.NoError(t, res.Body.Close())
		})
	}
}

func userWithPermissions(orgID int64, permissions []accesscontrol.Permission) *user.SignedInUser {
	return &user.SignedInUser{OrgID: orgID, OrgRole: org.RoleViewer, Permissions: map[int64]map[string][]string{orgID: accesscontrol.GroupScopesByAction(permissions)}}
}

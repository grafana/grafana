package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
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

func (m *LDAPMock) Login(query *models.LoginUserQuery) (*models.ExternalUserInfo, error) {
	return &models.ExternalUserInfo{}, nil
}

func (m *LDAPMock) Users(logins []string) ([]*models.ExternalUserInfo, error) {
	s := []*models.ExternalUserInfo{}
	return s, nil
}

func (m *LDAPMock) User(login string) (*models.ExternalUserInfo, ldap.ServerConfig, error) {
	return userSearchResult, userSearchConfig, nil
}

func getUserFromLDAPContext(t *testing.T, requestURL string) *scenarioContext {
	t.Helper()

	sc := setupScenarioContext(requestURL)

	hs := &HTTPServer{Cfg: setting.NewCfg()}

	sc.defaultHandler = Wrap(func(c *models.ReqContext) Response {
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

func TestGetUserFromLDAPApiEndpoint_UserNotFound(t *testing.T) {
	getLDAPConfig = func() (*ldap.Config, error) {
		return &ldap.Config{}, nil
	}

	newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
		return &LDAPMock{}
	}

	userSearchResult = nil

	sc := getUserFromLDAPContext(t, "/api/admin/ldap/user-that-does-not-exist")

	require.Equal(t, sc.resp.Code, http.StatusNotFound)
	responseString, err := getBody(sc.resp)

	assert.Nil(t, err)
	assert.Equal(t, "{\"message\":\"No user was found on the LDAP server(s)\"}", responseString)
}

func TestGetUserFromLDAPApiEndpoint_OrgNotfound(t *testing.T) {
	isAdmin := true
	userSearchResult = &models.ExternalUserInfo{
		Name:           "John Doe",
		Email:          "john.doe@example.com",
		Login:          "johndoe",
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
				OrgID:   1,
				OrgRole: models.ROLE_ADMIN,
			},
			{
				GroupDN: "cn=admins,ou=groups,dc=grafana2,dc=org",
				OrgID:   2,
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

	getLDAPConfig = func() (*ldap.Config, error) {
		return &ldap.Config{}, nil
	}

	newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
		return &LDAPMock{}
	}

	sc := getUserFromLDAPContext(t, "/api/admin/ldap/johndoe")

	require.Equal(t, sc.resp.Code, http.StatusBadRequest)

	jsonResponse, err := getJSONbody(sc.resp)
	assert.Nil(t, err)

	expected := `
	{
		"error": "Unable to find organization with ID '2'",
		"message": "Organization not found - Please verify your LDAP configuration"
	}
	`
	var expectedJSON interface{}
	_ = json.Unmarshal([]byte(expected), &expectedJSON)

	assert.Equal(t, jsonResponse, expectedJSON)
}

func TestGetUserFromLDAPApiEndpoint(t *testing.T) {
	isAdmin := true
	userSearchResult = &models.ExternalUserInfo{
		Name:           "John Doe",
		Email:          "john.doe@example.com",
		Login:          "johndoe",
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
				OrgID:   1,
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

	getLDAPConfig = func() (*ldap.Config, error) {
		return &ldap.Config{}, nil
	}

	newLDAP = func(_ []*ldap.ServerConfig) multildap.IMultiLDAP {
		return &LDAPMock{}
	}

	sc := getUserFromLDAPContext(t, "/api/admin/ldap/johndoe")

	require.Equal(t, sc.resp.Code, http.StatusOK)

	jsonResponse, err := getJSONbody(sc.resp)
	assert.Nil(t, err)

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
	var expectedJSON interface{}
	_ = json.Unmarshal([]byte(expected), &expectedJSON)

	assert.Equal(t, jsonResponse, expectedJSON)
}

package keystone

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

type v2_auth_post_struct struct {
	Auth v2_auth_struct `json:"auth"`
}

type v2_auth_struct struct {
	PasswordCredentials v2_credentials_struct `json:"passwordCredentials"`
	TenantName          string                `json:"tenantName"`
}

type v2_credentials_struct struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type v2_auth_response_struct struct {
	Access v2_access_struct
}

type v2_access_struct struct {
	Token v2_token_struct
}

type v2_token_struct struct {
	Id        string
	Expires   string
	Issued_at string
}

type v3_auth_post_struct struct {
	Auth v3_auth_struct `json:"auth"`
}

type v3_auth_struct struct {
	Identity v3_identity_struct `json:"identity"`
	Scope    v3_scope_struct    `json:"scope"`
}

type v3_identity_struct struct {
	Methods  []string                 `json:"methods"`
	Password v3_passwordmethod_struct `json:"password"`
}

type v3_passwordmethod_struct struct {
	User v3_user_struct `json:"user"`
}

type v3_user_struct struct {
	Name     string               `json:"name"`
	Password string               `json:"password"`
	Domain   v3_userdomain_struct `json:"domain"`
}

type v3_userdomain_struct struct {
	Name string `json:"name"`
}

type v3_scope_struct struct {
	Project v3_project_struct `json:"project"`
}

type v3_project_struct struct {
	Name   string                  `json:"name"`
	Domain v3_projectdomain_struct `json:"domain"`
}

type v3_projectdomain_struct struct {
	Name string `json:"name"`
}

func getUserName(c *middleware.Context) (string, error) {
	userQuery := m.GetUserByIdQuery{Id: c.Session.Get(middleware.SESS_KEY_USERID).(int64)}
	if err := bus.Dispatch(&userQuery); err != nil {
		if err == m.ErrUserNotFound {
			return "", err
		}
	}
	return userQuery.Result.Login, nil
}

func getOrgName(c *middleware.Context) (string, error) {
	orgQuery := m.GetOrgByIdQuery{Id: c.OrgId}
	if err := bus.Dispatch(&orgQuery); err != nil {
		if err == m.ErrOrgNotFound {
			return "", err
		}
	}
	return orgQuery.Result.Name, nil
}

func authenticateV2(c *middleware.Context) (string, error) {
	server := setting.KeystoneURL

	var auth_post v2_auth_post_struct
	if username, err := getUserName(c); err != nil {
		return "", err
	} else {
		auth_post.Auth.PasswordCredentials.Username = username
	}
	if tenant, err := getOrgName(c); err != nil {
		return "", err
	} else {
		auth_post.Auth.TenantName = tenant
	}
	auth_post.Auth.PasswordCredentials.Password = c.Session.Get(middleware.SESS_KEY_PASSWORD).(string)
	b, _ := json.Marshal(auth_post)

	request, err := http.NewRequest("POST", server+"/v2.0/tokens", bytes.NewBuffer(b))
	if err != nil {
		return "", err
	}

	client := &http.Client{}
	resp, err := client.Do(request)
	if err != nil {
		return "", err
	} else if resp.StatusCode != 200 {
		return "", errors.New("Keystone authentication failed: " + resp.Status)
	}

	decoder := json.NewDecoder(resp.Body)
	var auth_response v2_auth_response_struct
	err = decoder.Decode(&auth_response)
	if err != nil {
		return "", err
	}

	return auth_response.Access.Token.Id, nil
}

func authenticateV3(c *middleware.Context) (string, error) {
	server := setting.KeystoneURL

	var auth_post v3_auth_post_struct
	auth_post.Auth.Identity.Methods = []string{"password"}
	if username, err := getUserName(c); err != nil {
		return "", err
	} else {
		auth_post.Auth.Identity.Password.User.Name = username
	}
	if tenant, err := getOrgName(c); err != nil {
		return "", err
	} else {
		auth_post.Auth.Scope.Project.Name = tenant
	}
	auth_post.Auth.Identity.Password.User.Password = c.Session.Get(middleware.SESS_KEY_PASSWORD).(string)
	// the user domain name is currently hardcoded via a config setting - this should change to an extra domain field in the login dialog later
	auth_post.Auth.Identity.Password.User.Domain.Name = setting.KeystoneUserDomainName
	// set the project domain name to the user domain name, as we only deal with the projects for the domain the user logged in with
	auth_post.Auth.Scope.Project.Domain.Name = setting.KeystoneUserDomainName
	b, _ := json.Marshal(auth_post)

	request, err := http.NewRequest("POST", server+"/v3/auth/tokens", bytes.NewBuffer(b))
	if err != nil {
		return "", err
	}

	client := &http.Client{}
	resp, err := client.Do(request)
	if err != nil {
		return "", err
	} else if resp.StatusCode != 201 {
		return "", errors.New("Keystone authentication failed: " + resp.Status)
	}

	// in keystone v3 the token is in the response header
	return resp.Header.Get("X-Subject-Token"), nil
}

func GetToken(c *middleware.Context) (string, error) {
	var token string
	var err error
	if setting.KeystoneV3 {
		if token, err = authenticateV3(c); err != nil {
			return "", err
		}
	} else {
		if token, err = authenticateV2(c); err != nil {
			return "", err
		}
	}
	return token, nil
}

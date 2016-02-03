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
	Auth v2_auth_struct  `json:"auth"`
}

type v2_auth_struct struct {
	PasswordCredentials v2_credentials_struct  `json:"passwordCredentials"`
	TenantName   string `json:"tenantName"`
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

	request, err := http.NewRequest("POST", server + "/v2.0/tokens", bytes.NewBuffer(b))
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
	// TODO implement
	return "", errors.New("Keystone v3 authentication not implemented")
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
package external

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

func getImsUserInfo(c *contextmodel.ReqContext) (*ImsUserInfo, error) {
	//Fetch service account token
	jwtToken, err := getIMSToken(c.Req, c.OrgID, c.UserID)
	if err != nil {
		return nil, err
	}

	userInfo, err := _getImsUserInfo(jwtToken)
	if err != nil {
		return nil, err
	}

	return userInfo, nil
}

func _getImsUserInfo(jwtToken string) (*ImsUserInfo, error) {
	//Fetch user info with preferences
	url := imsServiceURL + "/ims/api/v1/userinfo?preferences=true&gs_product_id=HelixDashboard"
	method := "GET"
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Authorization", "Bearer "+jwtToken)

	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}

	defer res.Body.Close()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	userInfo := &ImsUserInfo{}
	if err := json.Unmarshal(body, userInfo); err != nil {
		return nil, err
	}

	return userInfo, nil
}

func setImsUserInfo(c *contextmodel.ReqContext) (string, error) {
	preferences := make([]Preference, 0)
	if err := web.Bind(c.Req, &preferences); err != nil {
		return "", err
	}
	payload, err := json.Marshal(preferences)
	if err != nil {
		return "", err
	}

	jwtToken, err := getIMSToken(c.Req, c.OrgID, c.UserID)
	if err != nil {
		return "", err
	}

	res, err := _setImsUserInfo(jwtToken, payload)
	if err != nil {
		return "", err
	}

	return res, nil
}

func _setImsUserInfo(jwtToken string, payload []byte) (string, error) {
	url := imsServiceURL + "/ims/api/v1/external/users/preferences"
	method := "POST"

	req, err := http.NewRequest(method, url, bytes.NewBuffer(payload))
	if err != nil {
		return "", err
	}

	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Authorization", "Bearer "+jwtToken)

	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}

	return string(body), nil
}

type ImsUserInfo struct {
	UserId           string       `json:"user_id"`
	FirstName        string       `json:"first_name"`
	LastName         string       `json:"last_name"`
	FullName         string       `json:"full_name"`
	PrincipalId      string       `json:"principal_id"`
	Email            string       `json:"email"`
	UserStatus       string       `json:"user_status"`
	Type             string       `json:"type"`
	AuthType         string       `json:"auth_type"`
	TenantId         string       `json:"tenant_id"`
	TenantName       string       `json:"tenant_name"`
	Roles            []string     `json:"roles"`
	Groups           []string     `json:"groups"`
	Permissions      []string     `json:"permissions"`
	Preferences      []Preference `json:"preferences"`
	TenantDomainName string       `json:"tenant_domain_name"`
}

type Preference struct {
	Key   string `json:"key"`
	Level string `json:"level"`
	Value string `json:"value"`
}

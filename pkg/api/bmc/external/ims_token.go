package external

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/setting"
)

func getIMSToken(req *http.Request, tenantId, userId int64) (string, error) {
	// Check if request has jwt set in headers
	jwtToken := req.Header.Get("X-Jwt-Token")
	if jwtToken != "" {
		return jwtToken, nil
	}

	// Check if we have token set in cookies
	jwtCookie, _ := req.Cookie("helix_jwt_token")
	if jwtCookie != nil {
		if jwtCookie.Value != "" {
			return jwtCookie.Value, nil
		}
	}

	// BMC change next block: To support IMS tenant 0
	if tenantId == setting.GF_Tenant0 {
		tenantId = setting.IMS_Tenant0
	}
	// Generate a new service account jwt
	serviceAccountToken, err := GetServiceAccountToken(tenantId)
	if err != nil {
		return "", fmt.Errorf("failed to get service account token")
	}

	// Generate a new user impersonation token
	impersonationToken, err := getServiceImpersonationToken(userId, serviceAccountToken)
	if err != nil {
		return "", fmt.Errorf("failed to get impersonation token")
	}

	return impersonationToken, nil
}

func GetServiceAccountToken(tenantId int64) (string, error) {
	if imsServiceAccKey == "" {
		return "", errors.New("IMS service account key is not set")
	}
	jsonData, err := json.Marshal(ImsServicePayload{
		TenantId:          tenantId,
		ServiceAccountKey: imsServiceAccKey,
		RoleNames:         []string{"Impersonator"},
	})
	if err != nil {
		return "", err
	}

	url := imsServiceURL + "/ims/api/internal/v1/auth/service_accounts/tokens"
	method := "POST"
	payload := strings.NewReader(string(jsonData))

	req, err := http.NewRequest(method, url, payload)
	if err != nil {
		return "", err
	}
	req.Header.Add("Content-Type", "application/json")

	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	if res.StatusCode != 200 {
		return "", fmt.Errorf("unauthorized")
	}

	jwt := JsonWebToken{}
	err = json.NewDecoder(res.Body).Decode(&jwt)
	if err != nil {
		return "", err
	}
	return jwt.JsonWebToken, nil
}

func getServiceImpersonationToken(userId int64, jwtToken string) (string, error) {
	jsonData, err := json.Marshal(ImsImpersonatePayload{
		UserId: userId,
	})
	if err != nil {
		return "", err
	}

	url := imsServiceURL + "/ims/api/internal/v1/auth/users/impersonate"
	method := "POST"
	payload := strings.NewReader(string(jsonData))

	req, err := http.NewRequest(method, url, payload)
	if err != nil {
		return "", err
	}
	req.Header.Add("Authorization", "Bearer "+jwtToken)
	req.Header.Add("Content-Type", "application/json")

	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	jwt := JsonWebToken{}
	err = json.NewDecoder(res.Body).Decode(&jwt)
	if err != nil {
		return "", err
	}
	return jwt.JsonWebToken, nil
}

func ExchangeIMSToken(targetTenantId, jwtToken string) (string, error) {

	if jwtToken == "" {
		return "", errors.New("JWT token is not set")
	}
	if targetTenantId == "" {
		return "", errors.New("Tenant Id is missing")
	}
	url := imsServiceURL + "/ims/api/v1/auth/msp/" + targetTenantId + "/tokens"
	method := "GET"

	req, err := http.NewRequest(method, url, nil)
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

	if res.StatusCode != 200 {
		return "", fmt.Errorf("unauthorized")
	}

	jwt := JsonWebToken{}
	err = json.NewDecoder(res.Body).Decode(&jwt)
	if err != nil {
		return "", err
	}
	return jwt.JsonWebToken, nil
}

type ImsImpersonatePayload struct {
	UserId int64 `json:"user_id"`
}

type JsonWebToken struct {
	JsonWebToken string `json:"json_web_token"`
}

type ImsServicePayload struct {
	TenantId          int64    `json:"tenant_id"`
	ServiceAccountKey string   `json:"service_account_key"`
	RoleNames         []string `json:"role_names"`
}

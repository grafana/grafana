package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"

	"github.com/grafana/grafana/pkg/services/org"
)

var (
	imsServiceURL    = os.Getenv("IMS_SERVICE_URL")
	imsServiceAccKey = os.Getenv("IMS_SERVICE_ACCOUNT_KEY")
)

var imsUserLogger = log.New("ims_tenant_users")

// Get Grafana and IMS Users, concatenate both and send them as a result
func (hs *HTTPServer) getTenantUsers(c *contextmodel.ReqContext) []*org.OrgUserDTO {
	query := c.Query("query")
	limit := c.QueryInt("limit")

	result := make([]*org.OrgUserDTO, 0)

	imsQuery := &org.GetOrgUsersQuery{OrgID: c.OrgID, Query: query, Limit: limit}

	if !c.SignedInUser.HasExternalOrg {
		imsResult := getTenantUsersHelper(c.Req.Context(), imsQuery, c.SignedInUser, "")
		result = append(result, imsResult...)
	} else if c.SignedInUser.HasRole(org.RoleAdmin) || c.IsUnrestrictedUser {
		imsResult := getTenantUsersHelper(c.Req.Context(), imsQuery, c.SignedInUser, "")
		result = append(result, imsResult...)
	} else {
		for _, mspOrg := range c.SignedInUser.MspOrgs {
			imsUserListResult := getTenantUsersHelper(c.Req.Context(), imsQuery, c.SignedInUser, mspOrg)
			result = append(result, imsUserListResult...)
		}
	}

	return result
}

func getTenantUsersHelper(ctx context.Context, data *org.GetOrgUsersQuery, user *user.SignedInUser, mspOrgID string) []*org.OrgUserDTO {
	result := make([]*org.OrgUserDTO, 0)

	if imsServiceURL == "" {
		err := errors.New("IMS service URL is not set")
		imsUserLogger.Error("Failed to fetch users", "reason", err.Error())
		return result
	}
	jwtToken, err := GetServiceAccountToken(data.OrgID)
	if err != nil {
		imsUserLogger.Error("Failed to fetch users", "reason", err.Error())
		return result
	}

	if data.Limit == 0 {
		data.Limit = 1000
	}
	jsonData, err := json.Marshal(ImsSearchUserQuery{
		Filters: []ImsSearchUserFilters{
			{
				Field:  "*",
				Values: []string{data.Query},
			},
		},
	})
	if err != nil {
		imsUserLogger.Error("Failed to fetch users", "reason", err.Error())
		return result
	}

	userSearchURL, err := url.Parse(imsServiceURL + "/ims/api/v1/users/search")
	if err != nil {
		imsUserLogger.Error("Failed to fetch users", "reason", err.Error())
		return result
	}
	queryParams := userSearchURL.Query()
	queryParams.Add("page", "0")
	queryParams.Add("size", strconv.Itoa(data.Limit))
	queryParams.Add("orderBy", "full_name")
	queryParams.Add("sortOrder", "asc")
	queryParams.Add("excludeApiKeyUsers", "true")

	// If mspOrgID is present then it will pull only MspOrg related users of that specific mspOrgID
	if user.HasExternalOrg && len(mspOrgID) != 0 {
		queryParams.Add("orgIds", mspOrgID)
	}

	userSearchURL.RawQuery = queryParams.Encode()

	method := "POST"
	payload := strings.NewReader(string(jsonData))
	req, err := http.NewRequestWithContext(ctx, method, userSearchURL.String(), payload)

	if err != nil {
		imsUserLogger.Error("Failed to fetch users", "reason", err.Error())
		return result
	}
	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Authorization", "Bearer "+jwtToken)

	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		imsUserLogger.Error("Failed to fetch users", "reason", err.Error())
		return result
	}
	defer res.Body.Close()

	imsUserResult := ImsUserSearchResult{}
	err = json.NewDecoder(res.Body).Decode(&imsUserResult)
	if err != nil {
		imsUserLogger.Error("Failed to fetch users", "reason", err.Error())
		return result
	}

	for _, record := range imsUserResult.Records {
		orgId, _ := strconv.ParseInt(record.TenantID, 10, 64)
		userId, _ := strconv.ParseInt(record.UserID, 10, 64)
		user := &org.OrgUserDTO{
			OrgID:  orgId,
			UserID: userId,
			Email:  record.Email,
			Name:   record.FullName,
		}
		result = append(result, user)
	}

	return result
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

func GetServiceImpersonationToken(userId int64, jwtToken string) (string, error) {
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

type ImsImpersonatePayload struct {
	UserId int64 `json:"user_id"`
}

type JsonWebToken struct {
	JsonWebToken string `json:"json_web_token"`
}
type ImsSearchUserQuery struct {
	Filters []ImsSearchUserFilters `json:"filters"`
}
type ImsSearchUserFilters struct {
	Field  string   `json:"field"`
	Values []string `json:"values"`
}

type ImsServicePayload struct {
	TenantId          int64    `json:"tenant_id"`
	ServiceAccountKey string   `json:"service_account_key"`
	RoleNames         []string `json:"role_names"`
}

type ImsUserSearchResult struct {
	Records []struct {
		TenantID string `json:"tenant_id"`
		UserID   string `json:"user_id"`
		Email    string `json:"email"`
		FullName string `json:"full_name"`
	} `json:"records"`
}

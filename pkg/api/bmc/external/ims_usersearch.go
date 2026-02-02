package external

import (
	"encoding/json"
	"errors"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

func filterInternalUsersByEmails(ctx *contextmodel.ReqContext, emails []string) ([]string, error) {
	imsUsers, err := findUsersByEmails(ctx, emails)
	if err != nil {
		return emails, err
	}

	internalEmails := make([]string, 0)
	for _, user := range imsUsers {
		if !Contains(internalEmails, user.Email) {
			internalEmails = append(internalEmails, user.Email)
		}
	}
	return internalEmails, nil
}

func findUsersByEmails(ctx *contextmodel.ReqContext, emails []string) ([]*org.OrgUserDTO, error) {
	result := make([]*org.OrgUserDTO, 0)

	if imsServiceURL == "" {
		return result, errors.New("IMS service URL is not set")
	}

	jwtToken, err := GetServiceAccountToken(ctx.OrgID)
	if err != nil {
		return result, err
	}

	jsonData, err := json.Marshal(ImsSearchUserQuery{
		Filters: []ImsSearchUserFilters{
			{
				Field:  "email",
				Values: emails,
			},
		},
	})

	if err != nil {
		return result, err
	}

	userSearchURL, err := url.Parse(imsServiceURL + "/ims/api/v1/users/search")
	if err != nil {
		return result, err
	}

	queryParams := userSearchURL.Query()
	queryParams.Add("page", "0")
	queryParams.Add("size", "1000")
	queryParams.Add("orderBy", "created_date_time")
	queryParams.Add("sortOrder", "asc")
	queryParams.Add("excludeApiKeyUsers", "true")

	// If mspOrgID is present then it will pull only MspOrg related users of that specific mspOrgID
	//if ctx.HasExternalOrg {
	//	queryParams.Add("orgId", "")
	//}

	userSearchURL.RawQuery = queryParams.Encode()

	method := "POST"
	payload := strings.NewReader(string(jsonData))
	req, err := http.NewRequestWithContext(ctx.Req.Context(), method, userSearchURL.String(), payload)

	if err != nil {
		return result, err
	}
	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Authorization", "Bearer "+jwtToken)

	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		return result, err
	}
	defer res.Body.Close()

	imsUserResult := ImsUserSearchResult{}
	err = json.NewDecoder(res.Body).Decode(&imsUserResult)
	if err != nil {
		return result, err
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

	return result, nil
}

type ImsSearchUserFilters struct {
	Field  string   `json:"field"`
	Values []string `json:"values"`
}

type ImsUserSearchResult struct {
	Records []struct {
		TenantID string `json:"tenant_id"`
		UserID   string `json:"user_id"`
		Email    string `json:"email"`
		FullName string `json:"full_name"`
	} `json:"records"`
}

type ImsSearchUserQuery struct {
	Filters []ImsSearchUserFilters `json:"filters"`
}

func Contains(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

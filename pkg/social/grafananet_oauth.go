package social

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/models"

	"golang.org/x/oauth2"
)

type SocialGrafanaNet struct {
	*oauth2.Config
	url                  string
	allowedOrganizations []string
	allowSignup          bool
}

type OrgRecord struct {
	Login string `json:"login"`
}

func (s *SocialGrafanaNet) Type() int {
	return int(models.GRAFANANET)
}

func (s *SocialGrafanaNet) IsEmailAllowed(email string) bool {
	return true
}

func (s *SocialGrafanaNet) IsSignupAllowed() bool {
	return s.allowSignup
}

func (s *SocialGrafanaNet) IsOrganizationMember(organizations []OrgRecord) bool {
	if len(s.allowedOrganizations) == 0 {
		return true
	}

	for _, allowedOrganization := range s.allowedOrganizations {
		for _, organization := range organizations {
			if organization.Login == allowedOrganization {
				return true
			}
		}
	}

	return false
}

func (s *SocialGrafanaNet) UserInfo(client *http.Client) (*BasicUserInfo, error) {
	var data struct {
		Id    int    `json:"id"`
		Name  string `json:"login"`
		Email string `json:"email"`
		Role  string `json:"role"`
		Orgs  []OrgRecord `json:"orgs"`
	}

	var err error
	r, err := client.Get(s.url + "/api/oauth2/user")
	if err != nil {
		return nil, err
	}

	defer r.Body.Close()

	if err = json.NewDecoder(r.Body).Decode(&data); err != nil {
		return nil, err
	}

	userInfo := &BasicUserInfo{
		Identity: strconv.Itoa(data.Id),
		Name:     data.Name,
		Email:    data.Email,
		Role:     data.Role,
	}

	if !s.IsOrganizationMember(data.Orgs) {
		return nil, ErrMissingOrganizationMembership
	}

	return userInfo, nil
}

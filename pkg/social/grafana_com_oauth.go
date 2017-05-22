package social

import (
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana/pkg/models"

	"golang.org/x/oauth2"
)

type SocialGrafanaCom struct {
	*oauth2.Config
	url                  string
	allowedOrganizations []string
	allowSignup          bool
}

type OrgRecord struct {
	Login string `json:"login"`
}

func (s *SocialGrafanaCom) Type() int {
	return int(models.GRAFANA_COM)
}

func (s *SocialGrafanaCom) IsEmailAllowed(email string) bool {
	return true
}

func (s *SocialGrafanaCom) IsSignupAllowed() bool {
	return s.allowSignup
}

func (s *SocialGrafanaCom) IsOrganizationMember(organizations []OrgRecord) bool {
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

func (s *SocialGrafanaCom) UserInfo(client *http.Client) (*BasicUserInfo, error) {
	var data struct {
		Name  string      `json:"name"`
		Login string      `json:"username"`
		Email string      `json:"email"`
		Role  string      `json:"role"`
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
		Name:  data.Name,
		Login: data.Login,
		Email: data.Email,
		Role:  data.Role,
	}

	if !s.IsOrganizationMember(data.Orgs) {
		return nil, ErrMissingOrganizationMembership
	}

	return userInfo, nil
}

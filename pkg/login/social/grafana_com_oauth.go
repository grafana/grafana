package social

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"

	"golang.org/x/oauth2"
)

type SocialGrafanaCom struct {
	*SocialBase
	url                  string
	allowedOrganizations []string
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

func (s *SocialGrafanaCom) UserInfo(client *http.Client, token *oauth2.Token) (*BasicUserInfo, error) {
	var data struct {
		Id    int         `json:"id"`
		Name  string      `json:"name"`
		Login string      `json:"username"`
		Email string      `json:"email"`
		Role  string      `json:"role"`
		Orgs  []OrgRecord `json:"orgs"`
	}

	response, err := HttpGet(client, s.url+"/api/oauth2/user")
	if err != nil {
		return nil, errutil.Wrap("error getting user info", err)
	}

	if err := json.Unmarshal(response.Body, &data); err != nil {
		return nil, errutil.Wrap("error getting user info", err)
	}
	role := models.RoleType(data.Role)
	if !role.IsValid() {
		role = models.ROLE_VIEWER
	}

	userInfo := &BasicUserInfo{
		Id:    fmt.Sprintf("%d", data.Id),
		Name:  data.Name,
		Login: data.Login,
		Email: data.Email,
	}
	if err := s.extractOrgMemberships(role, userInfo); err != nil {
		return nil, err
	}

	if !s.IsOrganizationMember(data.Orgs) {
		return nil, ErrMissingOrganizationMembership
	}

	return userInfo, nil
}

func (s *SocialGrafanaCom) extractOrgMemberships(role models.RoleType, userInfo *BasicUserInfo) error {
	userInfo.OrgMemberships = map[int64]models.RoleType{}

	var orgID int64
	if setting.AutoAssignOrg && setting.AutoAssignOrgId > 0 {
		orgID = int64(setting.AutoAssignOrgId)
		s.log.Debug("The user has a role assignment and organization membership is auto-assigned",
			"role", role, "orgId", orgID)
	} else {
		orgID = int64(1)
		s.log.Debug("The user has a role assignment and organization membership is not auto-assigned",
			"role", role, "orgId", orgID)
	}
	if _, ok := userInfo.OrgMemberships[orgID]; !ok {
		s.log.Debug("Assigning user role in organization", "role", role, "orgID", orgID)
		userInfo.OrgMemberships[orgID] = role
	}

	return nil
}

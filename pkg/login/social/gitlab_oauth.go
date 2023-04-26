package social

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/models/roletype"
)

type SocialGitlab struct {
	*SocialBase
	allowedGroups   []string
	apiUrl          string
	skipOrgRoleSync bool
}

func (s *SocialGitlab) IsGroupMember(groups []string) bool {
	if len(s.allowedGroups) == 0 {
		return true
	}

	for _, allowedGroup := range s.allowedGroups {
		for _, group := range groups {
			if group == allowedGroup {
				return true
			}
		}
	}

	return false
}

func (s *SocialGitlab) GetGroups(client *http.Client) []string {
	groups := make([]string, 0)

	for page, url := s.GetGroupsPage(client, s.apiUrl+"/groups"); page != nil; page, url = s.GetGroupsPage(client, url) {
		groups = append(groups, page...)
	}

	return groups
}

// GetGroupsPage returns groups and link to the next page if response is paginated
func (s *SocialGitlab) GetGroupsPage(client *http.Client, url string) ([]string, string) {
	type Group struct {
		FullPath string `json:"full_path"`
	}

	var (
		groups []Group
		next   string
	)

	if url == "" {
		return nil, next
	}

	response, err := s.httpGet(client, url)
	if err != nil {
		s.log.Error("Error getting groups from GitLab API", "err", err)
		return nil, next
	}

	if err := json.Unmarshal(response.Body, &groups); err != nil {
		s.log.Error("Error parsing JSON from GitLab API", "err", err)
		return nil, next
	}

	fullPaths := make([]string, len(groups))
	for i, group := range groups {
		fullPaths[i] = group.FullPath
	}

	// GitLab uses Link header with "rel" set to prev/next/first/last page. We need "next".
	if link, ok := response.Headers["Link"]; ok {
		pattern := regexp.MustCompile(`<([^>]+)>; rel="next"`)
		if matches := pattern.FindStringSubmatch(link[0]); matches != nil {
			next = matches[1]
		}
	}

	return fullPaths, next
}

func (s *SocialGitlab) UserInfo(client *http.Client, _ *oauth2.Token) (*BasicUserInfo, error) {
	var data struct {
		Id       int
		Username string
		Email    string
		Name     string
		State    string
	}

	response, err := s.httpGet(client, s.apiUrl+"/user")
	if err != nil {
		return nil, fmt.Errorf("Error getting user info: %s", err)
	}

	if err = json.Unmarshal(response.Body, &data); err != nil {
		return nil, fmt.Errorf("error getting user info: %s", err)
	}

	if data.State != "active" {
		return nil, fmt.Errorf("user %s is inactive", data.Username)
	}

	groups := s.GetGroups(client)

	var role roletype.RoleType
	var isGrafanaAdmin *bool = nil
	if !s.skipOrgRoleSync {
		var grafanaAdmin bool
		role, grafanaAdmin = s.extractRoleAndAdmin(response.Body, groups, true)
		if s.roleAttributeStrict && !role.IsValid() {
			return nil, &InvalidBasicRoleError{idP: "Gitlab", assignedRole: string(role)}
		}

		if s.allowAssignGrafanaAdmin {
			isGrafanaAdmin = &grafanaAdmin
		}
	}
	if s.allowAssignGrafanaAdmin && s.skipOrgRoleSync {
		s.log.Debug("allowAssignGrafanaAdmin and skipOrgRoleSync are both set, Grafana Admin role will not be synced, consider setting one or the other")
	}

	userInfo := &BasicUserInfo{
		Id:             fmt.Sprintf("%d", data.Id),
		Name:           data.Name,
		Login:          data.Username,
		Email:          data.Email,
		Groups:         groups,
		Role:           role,
		IsGrafanaAdmin: isGrafanaAdmin,
	}

	if !s.IsGroupMember(groups) {
		return nil, errMissingGroupMembership
	}

	return userInfo, nil
}

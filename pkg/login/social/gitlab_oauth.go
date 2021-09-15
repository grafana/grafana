package social

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"time"

	"github.com/grafana/grafana/pkg/models"

	"golang.org/x/oauth2"
)

type SocialGitlab struct {
	*SocialBase
	allowedGroups     []string
	apiUrl            string
	roleAttributePath string
}

type Group struct {
	ID                             int         `json:"id"`
	WebURL                         string      `json:"web_url"`
	Name                           string      `json:"name"`
	Path                           string      `json:"path"`
	Description                    string      `json:"description"`
	Visibility                     string      `json:"visibility"`
	ShareWithGroupLock             bool        `json:"share_with_group_lock"`
	RequireTwoFactorAuthentication bool        `json:"require_two_factor_authentication"`
	TwoFactorGracePeriod           int         `json:"two_factor_grace_period"`
	ProjectCreationLevel           string      `json:"project_creation_level"`
	AutoDevopsEnabled              interface{} `json:"auto_devops_enabled"`
	SubgroupCreationLevel          string      `json:"subgroup_creation_level"`
	EmailsDisabled                 interface{} `json:"emails_disabled"`
	MentionsDisabled               interface{} `json:"mentions_disabled"`
	LfsEnabled                     bool        `json:"lfs_enabled"`
	DefaultBranchProtection        int         `json:"default_branch_protection"`
	AvatarURL                      string      `json:"avatar_url"`
	RequestAccessEnabled           bool        `json:"request_access_enabled"`
	FullName                       string      `json:"full_name"`
	FullPath                       string      `json:"full_path"`
	CreatedAt                      time.Time   `json:"created_at"`
	ParentID                       interface{} `json:"parent_id"`
}

func (s *SocialGitlab) Type() int {
	return int(models.GITLAB)
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

func (s *SocialGitlab) GetGroups(client *http.Client) ([]string, []Group) {
	groupFullNames := make([]string, 0)
	groups := make([]Group, 0)
	for page, url, groupsJson := s.GetGroupsPage(client, s.apiUrl+"/groups"); page != nil; page, url, groupsJson = s.GetGroupsPage(client, url) {
		groupFullNames = append(groupFullNames, page...)
		groups = append(groups, groupsJson...)
	}

	return groupFullNames, groups
}

// GetGroupsPage returns groups and link to the next page if response is paginated
func (s *SocialGitlab) GetGroupsPage(client *http.Client, url string) ([]string, string, []Group) {
	var (
		groups []Group
		next   string
	)

	if url == "" {
		return nil, next, nil
	}

	response, err := s.httpGet(client, url)
	if err != nil {
		s.log.Error("Error getting groups from GitLab API", "err", err)
		return nil, next, nil
	}

	if err := json.Unmarshal(response.Body, &groups); err != nil {
		s.log.Error("Error parsing JSON from GitLab API", "err", err)
		return nil, next, nil
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

	return fullPaths, next, groups
}

func (s *SocialGitlab) UserInfo(client *http.Client, token *oauth2.Token) (*BasicUserInfo, error) {
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

	err = json.Unmarshal(response.Body, &data)
	if err != nil {
		return nil, fmt.Errorf("error getting user info: %s", err)
	}

	if data.State != "active" {
		return nil, fmt.Errorf("user %s is inactive", data.Username)
	}

	groupFullNames, groups := s.GetGroups(client)

	role, err := s.extractRole(response.Body)
	if err != nil {
		s.log.Error("Failed to extract role", "error", err)
	}

	// only evaluate groupqueries if userqueries haven't matched anything
	if role == "Viewer" || role == "" {
		println("userquery didn't evaluate")
		jsonGroups, err := json.Marshal(groups)
		if err != nil {
			s.log.Error("Failed To Remarshal Groups", "error", err)
		}

		role, err = s.extractRole(jsonGroups)
		if err != nil {
			s.log.Error("Failed to extract role", "error", err)
		}
	}

	userInfo := &BasicUserInfo{
		Id:     fmt.Sprintf("%d", data.Id),
		Name:   data.Name,
		Login:  data.Username,
		Email:  data.Email,
		Groups: groupFullNames,
		Role:   role,
	}

	if !s.IsGroupMember(groupFullNames) {
		return nil, errMissingGroupMembership
	}

	return userInfo, nil
}

func (s *SocialGitlab) extractRole(rawJSON []byte) (string, error) {
	if s.roleAttributePath == "" {
		return "", nil
	}

	role, err := s.searchJSONForStringAttr(s.roleAttributePath, rawJSON)
	if err != nil {
		return "", err
	}
	println(role)
	return role, nil
}

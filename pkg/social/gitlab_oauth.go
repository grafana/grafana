package social

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"

	"github.com/grafana/grafana/pkg/models"

	"golang.org/x/oauth2"
)

type SocialGitlab struct {
	*SocialBase
	allowedDomains []string
	allowedGroups  []string
	apiUrl         string
	allowSignup    bool
}

var (
	ErrMissingGroupMembership = &Error{"User not a member of one of the required groups"}
)

func (s *SocialGitlab) Type() int {
	return int(models.GITLAB)
}

func (s *SocialGitlab) IsEmailAllowed(email string) bool {
	return isEmailAllowed(email, s.allowedDomains)
}

func (s *SocialGitlab) IsSignupAllowed() bool {
	return s.allowSignup
}

func (s *SocialGitlab) IsGroupMember(client *http.Client) bool {
	if len(s.allowedGroups) == 0 {
		return true
	}

	for groups, url := s.GetGroups(client, s.apiUrl+"/groups"); groups != nil; groups, url = s.GetGroups(client, url) {
		for _, allowedGroup := range s.allowedGroups {
			for _, group := range groups {
				if group == allowedGroup {
					return true
				}
			}
		}
	}

	return false
}

func (s *SocialGitlab) GetGroups(client *http.Client, url string) ([]string, string) {
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

	response, err := HttpGet(client, url)
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

	if link, ok := response.Headers["Link"]; ok {
		pattern := regexp.MustCompile(`<([^>]+)>; rel="next"`)
		if matches := pattern.FindStringSubmatch(link[0]); matches != nil {
			next = matches[1]
		}
	}

	return fullPaths, next
}

func (s *SocialGitlab) UserInfo(client *http.Client, token *oauth2.Token) (*BasicUserInfo, error) {

	var data struct {
		Id       int
		Username string
		Email    string
		Name     string
		State    string
	}

	response, err := HttpGet(client, s.apiUrl+"/user")
	if err != nil {
		return nil, fmt.Errorf("Error getting user info: %s", err)
	}

	err = json.Unmarshal(response.Body, &data)
	if err != nil {
		return nil, fmt.Errorf("Error getting user info: %s", err)
	}

	if data.State != "active" {
		return nil, fmt.Errorf("User %s is inactive", data.Username)
	}

	userInfo := &BasicUserInfo{
		Id:    fmt.Sprintf("%d", data.Id),
		Name:  data.Name,
		Login: data.Username,
		Email: data.Email,
	}

	if !s.IsGroupMember(client) {
		return nil, ErrMissingGroupMembership
	}

	return userInfo, nil
}

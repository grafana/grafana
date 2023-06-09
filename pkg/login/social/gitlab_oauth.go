package social

import (
	"bytes"
	"compress/zlib"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
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

type apiData struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	State    string `json:"state"`
	Name     string `json:"name"`
}

type userData struct {
	ID     string   `json:"sub"`
	Login  string   `json:"preferred_username"`
	Email  string   `json:"email"`
	Name   string   `json:"name"`
	Groups []string `json:"groups_direct"`

	EmailVerified  bool              `json:"email_verified"`
	Role           roletype.RoleType `json:"-"`
	IsGrafanaAdmin *bool             `json:"-"`
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

func (s *SocialGitlab) UserInfo(client *http.Client, token *oauth2.Token) (*BasicUserInfo, error) {
	data := s.extractFromToken(token)

	// fallback to API
	if data == nil {
		var errAPI error
		data, errAPI = s.extractFromAPI(client, token)
		if errAPI != nil {
			return nil, errAPI
		}
	}

	userInfo := &BasicUserInfo{
		Id:             data.ID,
		Name:           data.Name,
		Login:          data.Login,
		Email:          data.Email,
		Groups:         data.Groups,
		Role:           data.Role,
		IsGrafanaAdmin: data.IsGrafanaAdmin,
	}

	if !s.IsGroupMember(data.Groups) {
		return nil, errMissingGroupMembership
	}

	if s.allowAssignGrafanaAdmin && s.skipOrgRoleSync {
		s.log.Debug("allowAssignGrafanaAdmin and skipOrgRoleSync are both set, Grafana Admin role will not be synced, consider setting one or the other")
	}

	return userInfo, nil
}

func (s *SocialGitlab) extractFromAPI(client *http.Client, token *oauth2.Token) (*userData, error) {
	apiResp := &apiData{}
	response, err := s.httpGet(client, s.apiUrl+"/user")
	if err != nil {
		return nil, fmt.Errorf("Error getting user info: %s", err)
	}

	if err = json.Unmarshal(response.Body, &apiResp); err != nil {
		return nil, fmt.Errorf("error getting user info: %s", err)
	}

	if apiResp.State != "active" {
		return nil, fmt.Errorf("user %s is inactive", apiResp.Username)
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

	return &userData{
		ID:             fmt.Sprintf("%d", apiResp.ID),
		Login:          apiResp.Username,
		Email:          apiResp.Email,
		Name:           apiResp.Name,
		Groups:         groups,
		Role:           role,
		IsGrafanaAdmin: isGrafanaAdmin,
	}, nil
}

func (s *SocialGitlab) extractFromToken(token *oauth2.Token) *userData {
	s.log.Debug("Extracting user info from OAuth token", fmt.Sprintf("%+v", token))

	idTokenAttribute := "id_token"

	idToken := token.Extra(idTokenAttribute)
	if idToken == nil {
		s.log.Debug("No id_token found", "token", token)
		return nil
	}

	jwtRegexp := regexp.MustCompile("^([-_a-zA-Z0-9=]+)[.]([-_a-zA-Z0-9=]+)[.]([-_a-zA-Z0-9=]+)$")
	matched := jwtRegexp.FindStringSubmatch(idToken.(string))
	if matched == nil {
		s.log.Debug("id_token is not in JWT format", "id_token", idToken.(string))
		return nil
	}

	// Check token signature

	rawJSON, err := base64.RawURLEncoding.DecodeString(matched[2])
	if err != nil {
		s.log.Error("Error base64 decoding id_token", "raw_payload", matched[2], "error", err)
		return nil
	}

	headerBytes, err := base64.RawURLEncoding.DecodeString(matched[1])
	if err != nil {
		s.log.Error("Error base64 decoding header", "header", matched[1], "error", err)
		return nil
	}

	var header map[string]interface{}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		s.log.Error("Error deserializing header", "error", err)
		return nil
	}

	if compressionVal, exists := header["zip"]; exists {
		compression, ok := compressionVal.(string)
		if !ok {
			s.log.Warn("Unknown compression algorithm")
			return nil
		}

		if compression != "DEF" {
			s.log.Warn("Unknown compression algorithm", "algorithm", compression)
			return nil
		}

		fr, err := zlib.NewReader(bytes.NewReader(rawJSON))
		if err != nil {
			s.log.Error("Error creating zlib reader", "error", err)
			return nil
		}
		defer func() {
			if err := fr.Close(); err != nil {
				s.log.Warn("Failed closing zlib reader", "error", err)
			}
		}()
		rawJSON, err = io.ReadAll(fr)
		if err != nil {
			s.log.Error("Error decompressing payload", "error", err)
			return nil
		}
	}

	var data userData
	if err := json.Unmarshal(rawJSON, &data); err != nil {
		s.log.Error("Error decoding id_token JSON", "raw_json", string(rawJSON), "error", err)
		return nil
	}

	s.log.Debug("Received id_token", "raw_json", string(rawJSON), "data", fmt.Sprintf("%+v", data))
	return &data
}

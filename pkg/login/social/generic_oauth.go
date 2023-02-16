package social

import (
	"bytes"
	"compress/zlib"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"regexp"
	"strconv"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type SocialGenericOAuth struct {
	*SocialBase
	allowedOrganizations []string
	apiUrl               string
	teamsUrl             string
	emailAttributeName   string
	emailAttributePath   string
	loginAttributePath   string
	nameAttributePath    string
	groupsAttributePath  string
	idTokenAttributeName string
	teamIdsAttributePath string
	teamIds              []string
}

func (s *SocialGenericOAuth) IsTeamMember(client *http.Client) bool {
	if len(s.teamIds) == 0 {
		return true
	}

	teamMemberships, err := s.FetchTeamMemberships(client)
	if err != nil {
		return false
	}

	for _, teamId := range s.teamIds {
		for _, membershipId := range teamMemberships {
			if teamId == membershipId {
				return true
			}
		}
	}

	return false
}

func (s *SocialGenericOAuth) IsOrganizationMember(client *http.Client) bool {
	if len(s.allowedOrganizations) == 0 {
		return true
	}

	organizations, ok := s.FetchOrganizations(client)
	if !ok {
		return false
	}

	for _, allowedOrganization := range s.allowedOrganizations {
		for _, organization := range organizations {
			if organization == allowedOrganization {
				return true
			}
		}
	}

	return false
}

type UserInfoJson struct {
	Name        string              `json:"name"`
	DisplayName string              `json:"display_name"`
	Login       string              `json:"login"`
	Username    string              `json:"username"`
	Email       string              `json:"email"`
	Upn         string              `json:"upn"`
	Attributes  map[string][]string `json:"attributes"`
	rawJSON     []byte
	source      string
}

func (info *UserInfoJson) String() string {
	return fmt.Sprintf(
		"Name: %s, Displayname: %s, Login: %s, Username: %s, Email: %s, Upn: %s, Attributes: %v",
		info.Name, info.DisplayName, info.Login, info.Username, info.Email, info.Upn, info.Attributes)
}

func (s *SocialGenericOAuth) UserInfo(client *http.Client, token *oauth2.Token) (*BasicUserInfo, error) {
	s.log.Debug("Getting user info")
	toCheck := make([]*UserInfoJson, 0, 2)

	if tokenData := s.extractFromToken(token); tokenData != nil {
		toCheck = append(toCheck, tokenData)
	}
	if apiData := s.extractFromAPI(client); apiData != nil {
		toCheck = append(toCheck, apiData)
	}

	userInfo := &BasicUserInfo{}
	for _, data := range toCheck {
		s.log.Debug("Processing external user info", "source", data.source, "data", data)

		if userInfo.Name == "" {
			userInfo.Name = s.extractUserName(data)
		}

		if userInfo.Login == "" {
			if data.Login != "" {
				s.log.Debug("Setting user info login from login field", "login", data.Login)
				userInfo.Login = data.Login
			} else {
				if s.loginAttributePath != "" {
					s.log.Debug("Searching for login among JSON", "loginAttributePath", s.loginAttributePath)
					login, err := s.searchJSONForStringAttr(s.loginAttributePath, data.rawJSON)
					if err != nil {
						s.log.Error("Failed to search JSON for login attribute", "error", err)
					} else if login != "" {
						userInfo.Login = login
						s.log.Debug("Setting user info login from login field", "login", login)
					}
				}

				if userInfo.Login == "" && data.Username != "" {
					s.log.Debug("Setting user info login from username field", "username", data.Username)
					userInfo.Login = data.Username
				}
			}
		}

		if userInfo.Email == "" {
			userInfo.Email = s.extractEmail(data)
			if userInfo.Email != "" {
				s.log.Debug("Set user info email from extracted email", "email", userInfo.Email)
			}
		}

		if userInfo.Role == "" {
			if !s.skipOrgRoleSync {
				role, grafanaAdmin := s.extractRoleAndAdmin(data.rawJSON, []string{}, true)
				if role != "" {
					s.log.Debug("Setting user info role from extracted role")

					userInfo.Role = role
					if s.allowAssignGrafanaAdmin {
						userInfo.IsGrafanaAdmin = &grafanaAdmin
					}
				}
			}
			if s.allowAssignGrafanaAdmin && s.skipOrgRoleSync {
				s.log.Warn("allowAssignGrafanaAdmin and skipOrgRoleSync are both set, Grafana Admin role will not be synced, consider setting one or the other")
			}
		}

		if len(userInfo.Groups) == 0 {
			groups, err := s.extractGroups(data)
			if err != nil {
				s.log.Warn("Failed to extract groups", "err", err)
			} else if len(groups) > 0 {
				s.log.Debug("Setting user info groups from extracted groups")
				userInfo.Groups = groups
			}
		}
	}

	if s.roleAttributeStrict && !userInfo.Role.IsValid() {
		return nil, &InvalidBasicRoleError{assignedRole: string(userInfo.Role)}
	}

	if userInfo.Email == "" {
		var err error
		userInfo.Email, err = s.FetchPrivateEmail(client)
		if err != nil {
			return nil, err
		}
		s.log.Debug("Setting email from fetched private email", "email", userInfo.Email)
	}

	if userInfo.Login == "" {
		s.log.Debug("Defaulting to using email for user info login", "email", userInfo.Email)
		userInfo.Login = userInfo.Email
	}

	if !s.IsTeamMember(client) {
		return nil, errors.New("user not a member of one of the required teams")
	}

	if !s.IsOrganizationMember(client) {
		return nil, errors.New("user not a member of one of the required organizations")
	}

	s.log.Debug("User info result", "result", userInfo)
	return userInfo, nil
}

func (s *SocialGenericOAuth) extractFromToken(token *oauth2.Token) *UserInfoJson {
	s.log.Debug("Extracting user info from OAuth token")

	idTokenAttribute := "id_token"
	if s.idTokenAttributeName != "" {
		idTokenAttribute = s.idTokenAttributeName
		s.log.Debug("Using custom id_token attribute name", "attribute_name", idTokenAttribute)
	}

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

	var data UserInfoJson
	if err := json.Unmarshal(rawJSON, &data); err != nil {
		s.log.Error("Error decoding id_token JSON", "raw_json", string(data.rawJSON), "error", err)
		return nil
	}

	data.rawJSON = rawJSON
	data.source = "token"
	s.log.Debug("Received id_token", "raw_json", string(data.rawJSON), "data", data.String())
	return &data
}

func (s *SocialGenericOAuth) extractFromAPI(client *http.Client) *UserInfoJson {
	s.log.Debug("Getting user info from API")
	if s.apiUrl == "" {
		s.log.Debug("No api url configured")
		return nil
	}

	rawUserInfoResponse, err := s.httpGet(client, s.apiUrl)
	if err != nil {
		s.log.Debug("Error getting user info from API", "url", s.apiUrl, "error", err)
		return nil
	}

	rawJSON := rawUserInfoResponse.Body

	var data UserInfoJson
	if err := json.Unmarshal(rawJSON, &data); err != nil {
		s.log.Error("Error decoding user info response", "raw_json", rawJSON, "error", err)
		return nil
	}

	data.rawJSON = rawJSON
	data.source = "API"
	s.log.Debug("Received user info response from API", "raw_json", string(rawJSON), "data", data.String())
	return &data
}

func (s *SocialGenericOAuth) extractEmail(data *UserInfoJson) string {
	if data.Email != "" {
		return data.Email
	}

	if s.emailAttributePath != "" {
		email, err := s.searchJSONForStringAttr(s.emailAttributePath, data.rawJSON)
		if err != nil {
			s.log.Error("Failed to search JSON for attribute", "error", err)
		} else if email != "" {
			return email
		}
	}

	emails, ok := data.Attributes[s.emailAttributeName]
	if ok && len(emails) != 0 {
		return emails[0]
	}

	if data.Upn != "" {
		emailAddr, emailErr := mail.ParseAddress(data.Upn)
		if emailErr == nil {
			return emailAddr.Address
		}
		s.log.Debug("Failed to parse e-mail address", "error", emailErr.Error())
	}

	return ""
}

func (s *SocialGenericOAuth) extractUserName(data *UserInfoJson) string {
	if s.nameAttributePath != "" {
		name, err := s.searchJSONForStringAttr(s.nameAttributePath, data.rawJSON)
		if err != nil {
			s.log.Error("Failed to search JSON for attribute", "error", err)
		} else if name != "" {
			s.log.Debug("Setting user info name from nameAttributePath", "nameAttributePath", s.nameAttributePath)
			return name
		}
	}

	if data.Name != "" {
		s.log.Debug("Setting user info name from name field")
		return data.Name
	}

	if data.DisplayName != "" {
		s.log.Debug("Setting user info name from display name field")
		return data.DisplayName
	}

	s.log.Debug("Unable to find user info name")
	return ""
}

func (s *SocialGenericOAuth) extractGroups(data *UserInfoJson) ([]string, error) {
	if s.groupsAttributePath == "" {
		return []string{}, nil
	}

	return s.searchJSONForStringArrayAttr(s.groupsAttributePath, data.rawJSON)
}

func (s *SocialGenericOAuth) FetchPrivateEmail(client *http.Client) (string, error) {
	type Record struct {
		Email       string `json:"email"`
		Primary     bool   `json:"primary"`
		IsPrimary   bool   `json:"is_primary"`
		Verified    bool   `json:"verified"`
		IsConfirmed bool   `json:"is_confirmed"`
	}

	response, err := s.httpGet(client, fmt.Sprintf(s.apiUrl+"/emails"))
	if err != nil {
		s.log.Error("Error getting email address", "url", s.apiUrl+"/emails", "error", err)
		return "", fmt.Errorf("%v: %w", "Error getting email address", err)
	}

	var records []Record

	err = json.Unmarshal(response.Body, &records)
	if err != nil {
		var data struct {
			Values []Record `json:"values"`
		}

		err = json.Unmarshal(response.Body, &data)
		if err != nil {
			s.log.Error("Error decoding email addresses response", "raw_json", string(response.Body), "error", err)
			return "", fmt.Errorf("%v: %w", "Error decoding email addresses response", err)
		}

		records = data.Values
	}

	s.log.Debug("Received email addresses", "emails", records)

	var email = ""
	for _, record := range records {
		if record.Primary || record.IsPrimary {
			email = record.Email
			break
		}
	}

	s.log.Debug("Using email address", "email", email)

	return email, nil
}

func (s *SocialGenericOAuth) FetchTeamMemberships(client *http.Client) ([]string, error) {
	var err error
	var ids []string

	if s.teamsUrl == "" {
		ids, err = s.fetchTeamMembershipsFromDeprecatedTeamsUrl(client)
	} else {
		ids, err = s.fetchTeamMembershipsFromTeamsUrl(client)
	}

	if err == nil {
		s.log.Debug("Received team memberships", "ids", ids)
	}

	return ids, err
}

func (s *SocialGenericOAuth) fetchTeamMembershipsFromDeprecatedTeamsUrl(client *http.Client) ([]string, error) {
	var response httpGetResponse
	var err error
	var ids []string

	type Record struct {
		Id int `json:"id"`
	}

	response, err = s.httpGet(client, fmt.Sprintf(s.apiUrl+"/teams"))
	if err != nil {
		s.log.Error("Error getting team memberships", "url", s.apiUrl+"/teams", "error", err)
		return []string{}, err
	}

	var records []Record

	err = json.Unmarshal(response.Body, &records)
	if err != nil {
		s.log.Error("Error decoding team memberships response", "raw_json", string(response.Body), "error", err)
		return []string{}, err
	}

	ids = make([]string, len(records))
	for i, record := range records {
		ids[i] = strconv.Itoa(record.Id)
	}

	return ids, nil
}

func (s *SocialGenericOAuth) fetchTeamMembershipsFromTeamsUrl(client *http.Client) ([]string, error) {
	if s.teamIdsAttributePath == "" {
		return []string{}, nil
	}

	var response httpGetResponse
	var err error

	response, err = s.httpGet(client, fmt.Sprintf(s.teamsUrl))
	if err != nil {
		s.log.Error("Error getting team memberships", "url", s.teamsUrl, "error", err)
		return nil, err
	}

	return s.searchJSONForStringArrayAttr(s.teamIdsAttributePath, response.Body)
}

func (s *SocialGenericOAuth) FetchOrganizations(client *http.Client) ([]string, bool) {
	type Record struct {
		Login string `json:"login"`
	}

	response, err := s.httpGet(client, fmt.Sprintf(s.apiUrl+"/orgs"))
	if err != nil {
		s.log.Error("Error getting organizations", "url", s.apiUrl+"/orgs", "error", err)
		return nil, false
	}

	var records []Record

	err = json.Unmarshal(response.Body, &records)
	if err != nil {
		s.log.Error("Error decoding organization response", "response", string(response.Body), "error", err)
		return nil, false
	}

	var logins = make([]string, len(records))
	for i, record := range records {
		logins[i] = record.Login
	}

	s.log.Debug("Received organizations", "logins", logins)

	return logins, true
}

func (s *SocialGenericOAuth) AuthCodeURL(state string, opts ...oauth2.AuthCodeOption) string {
	if s.features.IsEnabled(featuremgmt.FlagAccessTokenExpirationCheck) {
		opts = append(opts, oauth2.AccessTypeOffline)
	}
	return s.SocialBase.AuthCodeURL(state, opts...)
}

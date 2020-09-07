package social

import (
	"bytes"
	"compress/zlib"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/mail"
	"regexp"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util/errutil"
	"golang.org/x/oauth2"
)

type SocialGenericOAuth struct {
	*SocialBase
	allowedOrganizations []string
	apiUrl               string
	emailAttributeName   string
	emailAttributePath   string
	loginAttributePath   string
	roleAttributePath    string
	idTokenAttributeName string
	teamIds              []int
}

func (s *SocialGenericOAuth) Type() int {
	return int(models.GENERIC)
}

func (s *SocialGenericOAuth) IsTeamMember(client *http.Client) bool {
	if len(s.teamIds) == 0 {
		return true
	}

	teamMemberships, ok := s.FetchTeamMemberships(client)
	if !ok {
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
	tokenData := s.extractFromToken(token)
	apiData := s.extractFromAPI(client)

	userInfo := &BasicUserInfo{}
	for _, data := range []*UserInfoJson{tokenData, apiData} {
		if data == nil {
			continue
		}

		s.log.Debug("Processing external user info", "source", data.source, "data", data)

		if userInfo.Name == "" {
			if data.Name != "" {
				s.log.Debug("Setting user info name from name field")
				userInfo.Name = data.Name
			} else if data.DisplayName != "" {
				s.log.Debug("Setting user info name from display name field")
				userInfo.Name = data.DisplayName
			}
		}

		if userInfo.Login == "" {
			if data.Login != "" {
				s.log.Debug("Setting user info login from login field", "login", data.Login)
				userInfo.Login = data.Login
			} else {
				if s.loginAttributePath != "" {
					s.log.Debug("Searching for login among JSON", "loginAttributePath", s.loginAttributePath)
					login, err := s.searchJSONForAttr(s.loginAttributePath, data.rawJSON)
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
			role, err := s.extractRole(data)
			if err != nil {
				s.log.Error("Failed to extract role", "error", err)
			} else if role != "" {
				s.log.Debug("Setting user info role from extracted role")
				userInfo.Role = role
			}
		}
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

	var header map[string]string
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		s.log.Error("Error deserializing header", "error", err)
		return nil
	}

	if compression, ok := header["zip"]; ok {
		if compression != "DEF" {
			s.log.Warn("Unknown compression algorithm", "algorithm", compression)
			return nil
		}

		fr, err := zlib.NewReader(bytes.NewReader(rawJSON))
		if err != nil {
			s.log.Error("Error creating zlib reader", "error", err)
			return nil
		}
		defer fr.Close()
		rawJSON, err = ioutil.ReadAll(fr)
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
	s.log.Debug("Received id_token", "raw_json", string(data.rawJSON), "data", data)
	return &data
}

func (s *SocialGenericOAuth) extractFromAPI(client *http.Client) *UserInfoJson {
	s.log.Debug("Getting user info from API")
	rawUserInfoResponse, err := HttpGet(client, s.apiUrl)
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
	s.log.Debug("Received user info response from API", "raw_json", string(rawJSON), "data", data)
	return &data
}

func (s *SocialGenericOAuth) extractEmail(data *UserInfoJson) string {
	if data.Email != "" {
		return data.Email
	}

	if s.emailAttributePath != "" {
		email, err := s.searchJSONForAttr(s.emailAttributePath, data.rawJSON)
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

func (s *SocialGenericOAuth) extractRole(data *UserInfoJson) (string, error) {
	if s.roleAttributePath == "" {
		return "", nil
	}

	role, err := s.searchJSONForAttr(s.roleAttributePath, data.rawJSON)
	if err != nil {
		return "", err
	}
	return role, nil
}

func (s *SocialGenericOAuth) FetchPrivateEmail(client *http.Client) (string, error) {
	type Record struct {
		Email       string `json:"email"`
		Primary     bool   `json:"primary"`
		IsPrimary   bool   `json:"is_primary"`
		Verified    bool   `json:"verified"`
		IsConfirmed bool   `json:"is_confirmed"`
	}

	response, err := HttpGet(client, fmt.Sprintf(s.apiUrl+"/emails"))
	if err != nil {
		s.log.Error("Error getting email address", "url", s.apiUrl+"/emails", "error", err)
		return "", errutil.Wrap("Error getting email address", err)
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
			return "", errutil.Wrap("Error decoding email addresses response", err)
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

func (s *SocialGenericOAuth) FetchTeamMemberships(client *http.Client) ([]int, bool) {
	type Record struct {
		Id int `json:"id"`
	}

	response, err := HttpGet(client, fmt.Sprintf(s.apiUrl+"/teams"))
	if err != nil {
		s.log.Error("Error getting team memberships", "url", s.apiUrl+"/teams", "error", err)
		return nil, false
	}

	var records []Record

	err = json.Unmarshal(response.Body, &records)
	if err != nil {
		s.log.Error("Error decoding team memberships response", "raw_json", string(response.Body), "error", err)
		return nil, false
	}

	var ids = make([]int, len(records))
	for i, record := range records {
		ids[i] = record.Id
	}

	s.log.Debug("Received team memberships", "ids", ids)

	return ids, true
}

func (s *SocialGenericOAuth) FetchOrganizations(client *http.Client) ([]string, bool) {
	type Record struct {
		Login string `json:"login"`
	}

	response, err := HttpGet(client, fmt.Sprintf(s.apiUrl+"/orgs"))
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

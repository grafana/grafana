package social

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"regexp"

	"github.com/grafana/grafana/pkg/util/errutil"

	"github.com/grafana/grafana/pkg/models"
	"github.com/jmespath/go-jmespath"
	"golang.org/x/oauth2"
)

type SocialGenericOAuth struct {
	*SocialBase
	allowedDomains       []string
	allowedOrganizations []string
	apiUrl               string
	allowSignup          bool
	emailAttributeName   string
	emailAttributePath   string
	roleAttributePath    string
	teamIds              []int
}

func (s *SocialGenericOAuth) Type() int {
	return int(models.GENERIC)
}

func (s *SocialGenericOAuth) IsEmailAllowed(email string) bool {
	return isEmailAllowed(email, s.allowedDomains)
}

func (s *SocialGenericOAuth) IsSignupAllowed() bool {
	return s.allowSignup
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
}

func (info *UserInfoJson) String() string {
	return fmt.Sprintf(
		"Name: %s, Displayname: %s, Login: %s, Username: %s, Email: %s, Upn: %s, Attributes: %v",
		info.Name, info.DisplayName, info.Login, info.Username, info.Email, info.Upn, info.Attributes)
}

func (s *SocialGenericOAuth) UserInfo(client *http.Client, token *oauth2.Token) (*BasicUserInfo, error) {
	var data UserInfoJson
	var err error

	userInfo := &BasicUserInfo{}

	if s.extractToken(&data, token) {
		s.fillUserInfo(userInfo, &data)
	}

	if s.extractAPI(&data, client) {
		s.fillUserInfo(userInfo, &data)
	}

	if userInfo.Email == "" {
		userInfo.Email, err = s.FetchPrivateEmail(client)
		if err != nil {
			return nil, err
		}
	}

	if userInfo.Login == "" {
		userInfo.Login = userInfo.Email
	}

	if !s.IsTeamMember(client) {
		return nil, errors.New("User not a member of one of the required teams")
	}

	if !s.IsOrganizationMember(client) {
		return nil, errors.New("User not a member of one of the required organizations")
	}

	s.log.Debug("User info result", "result", userInfo)
	return userInfo, nil
}

func (s *SocialGenericOAuth) fillUserInfo(userInfo *BasicUserInfo, data *UserInfoJson) {
	if userInfo.Email == "" {
		userInfo.Email = s.extractEmail(data)
	}
	if userInfo.Role == "" {
		userInfo.Role = s.extractRole(data)
	}
	if userInfo.Name == "" {
		userInfo.Name = s.extractName(data)
	}
	if userInfo.Login == "" {
		userInfo.Login = s.extractLogin(data)
	}
}

func (s *SocialGenericOAuth) extractToken(data *UserInfoJson, token *oauth2.Token) bool {
	var err error

	idToken := token.Extra("id_token")
	if idToken == nil {
		s.log.Debug("No id_token found", "token", token)
		return false
	}

	jwtRegexp := regexp.MustCompile("^([-_a-zA-Z0-9=]+)[.]([-_a-zA-Z0-9=]+)[.]([-_a-zA-Z0-9=]+)$")
	matched := jwtRegexp.FindStringSubmatch(idToken.(string))
	if matched == nil {
		s.log.Debug("id_token is not in JWT format", "id_token", idToken.(string))
		return false
	}

	data.rawJSON, err = base64.RawURLEncoding.DecodeString(matched[2])
	if err != nil {
		s.log.Error("Error base64 decoding id_token", "raw_payload", matched[2], "error", err)
		return false
	}

	err = json.Unmarshal(data.rawJSON, data)
	if err != nil {
		s.log.Error("Error decoding id_token JSON", "raw_json", string(data.rawJSON), "error", err)
		data.rawJSON = []byte{}
		return false
	}

	s.log.Debug("Received id_token", "raw_json", string(data.rawJSON), "data", data)
	return true
}

func (s *SocialGenericOAuth) extractAPI(data *UserInfoJson, client *http.Client) bool {
	rawUserInfoResponse, err := HttpGet(client, s.apiUrl)
	if err != nil {
		s.log.Debug("Error getting user info response", "url", s.apiUrl, "error", err)
		return false
	}
	data.rawJSON = rawUserInfoResponse.Body

	err = json.Unmarshal(data.rawJSON, data)
	if err != nil {
		s.log.Error("Error decoding user info response", "raw_json", data.rawJSON, "error", err)
		data.rawJSON = []byte{}
		return false
	}

	s.log.Debug("Received user info response", "raw_json", string(data.rawJSON), "data", data)
	return true
}

func (s *SocialGenericOAuth) extractEmail(data *UserInfoJson) string {
	if data.Email != "" {
		return data.Email
	}

	if s.emailAttributePath != "" {
		email := s.searchJSONForAttr(s.emailAttributePath, data.rawJSON)
		if email != "" {
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

func (s *SocialGenericOAuth) extractRole(data *UserInfoJson) string {
	if s.roleAttributePath != "" {
		role := s.searchJSONForAttr(s.roleAttributePath, data.rawJSON)
		if role != "" {
			return role
		}
	}
	return ""
}

func (s *SocialGenericOAuth) extractLogin(data *UserInfoJson) string {
	if data.Login != "" {
		return data.Login
	}

	if data.Username != "" {
		return data.Username
	}

	return ""
}

func (s *SocialGenericOAuth) extractName(data *UserInfoJson) string {
	if data.Name != "" {
		return data.Name
	}

	if data.DisplayName != "" {
		return data.DisplayName
	}

	return ""
}

// searchJSONForAttr searches the provided JSON response for the given attribute
// using the configured  attribute path associated with the generic OAuth
// provider.
// Returns an empty string if an attribute is not found.
func (s *SocialGenericOAuth) searchJSONForAttr(attributePath string, data []byte) string {
	if attributePath == "" {
		s.log.Error("No attribute path specified")
		return ""
	}
	if len(data) == 0 {
		s.log.Error("Empty user info JSON response provided")
		return ""
	}
	var buf interface{}
	if err := json.Unmarshal(data, &buf); err != nil {
		s.log.Error("Failed to unmarshal user info JSON response", "err", err.Error())
		return ""
	}
	val, err := jmespath.Search(attributePath, buf)
	if err != nil {
		s.log.Error("Failed to search user info JSON response with provided path", "attributePath", attributePath, "err", err.Error())
		return ""
	}
	strVal, ok := val.(string)
	if ok {
		return strVal
	}
	s.log.Error("Attribute not found when searching JSON with provided path", "attributePath", attributePath)
	return ""
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
			return "", errutil.Wrap("Erro decoding email addresses response", err)
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

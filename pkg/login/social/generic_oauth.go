package social

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"regexp"

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

	organizations, err := s.FetchOrganizations(client)
	if err != nil {
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

// searchJSONForEmail searches the provided JSON response for an e-mail address
// using the configured e-mail attribute path associated with the generic OAuth
// provider.
// Returns a non-nil error if the provided JSON response could not be decoded,
// searched, or if an e-mail address is not found.
func (s *SocialGenericOAuth) searchJSONForEmail(data []byte) (email string, err error) {
	if s.emailAttributePath == "" {
		return "", errors.New("No e-mail attribute path specified")
	}
	if len(data) == 0 {
		return "", errors.New("Empty user info JSON response provided")
	}
	var buf interface{}
	if err := json.Unmarshal(data, &buf); err != nil {
		return "", err
	}
	val, err := jmespath.Search(s.emailAttributePath, buf)
	if err != nil {
		return "", err
	}
	strVal, ok := val.(string)
	if ok {
		return strVal, nil
	}
	return "", fmt.Errorf("E-mail not found when searching JSON with provided path: %s", s.emailAttributePath)
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
		return "", fmt.Errorf("Error getting email address: %s", err)
	}

	var records []Record

	err = json.Unmarshal(response.Body, &records)
	if err != nil {
		var data struct {
			Values []Record `json:"values"`
		}

		err = json.Unmarshal(response.Body, &data)
		if err != nil {
			return "", fmt.Errorf("Error getting email address: %s", err)
		}

		records = data.Values
	}

	var email = ""
	for _, record := range records {
		if record.Primary || record.IsPrimary {
			email = record.Email
			break
		}
	}

	return email, nil
}

func (s *SocialGenericOAuth) FetchTeamMemberships(client *http.Client) ([]int, error) {
	type Record struct {
		Id int `json:"id"`
	}

	response, err := HttpGet(client, fmt.Sprintf(s.apiUrl+"/teams"))
	if err != nil {
		return nil, fmt.Errorf("Error getting team memberships: %s", err)
	}

	var records []Record

	err = json.Unmarshal(response.Body, &records)
	if err != nil {
		return nil, fmt.Errorf("Error getting team memberships: %s", err)
	}

	var ids = make([]int, len(records))
	for i, record := range records {
		ids[i] = record.Id
	}

	return ids, nil
}

func (s *SocialGenericOAuth) FetchOrganizations(client *http.Client) ([]string, error) {
	type Record struct {
		Login string `json:"login"`
	}

	response, err := HttpGet(client, fmt.Sprintf(s.apiUrl+"/orgs"))
	if err != nil {
		return nil, fmt.Errorf("Error getting organizations: %s", err)
	}

	var records []Record

	err = json.Unmarshal(response.Body, &records)
	if err != nil {
		return nil, fmt.Errorf("Error getting organizations: %s", err)
	}

	var logins = make([]string, len(records))
	for i, record := range records {
		logins[i] = record.Login
	}

	return logins, nil
}

type UserInfoJson struct {
	Name        string              `json:"name"`
	DisplayName string              `json:"display_name"`
	Login       string              `json:"login"`
	Username    string              `json:"username"`
	Email       string              `json:"email"`
	Upn         string              `json:"upn"`
	Attributes  map[string][]string `json:"attributes"`
}

func (s *SocialGenericOAuth) UserInfo(client *http.Client, token *oauth2.Token) (*BasicUserInfo, error) {
	var data UserInfoJson
	var rawUserInfoResponse HttpGetResponse
	var err error

	if !s.extractToken(&data, token) {
		rawUserInfoResponse, err = HttpGet(client, s.apiUrl)
		if err != nil {
			return nil, fmt.Errorf("Error getting user info: %s", err)
		}

		err = json.Unmarshal(rawUserInfoResponse.Body, &data)
		if err != nil {
			return nil, fmt.Errorf("Error decoding user info JSON: %s", err)
		}
	}

	name := s.extractName(&data)

	email, err := s.extractEmail(&data, rawUserInfoResponse.Body)
	if err != nil {
		email, err = s.FetchPrivateEmail(client)
		if err != nil {
			return nil, err
		}
	}

	login := s.extractLogin(&data, email)

	userInfo := &BasicUserInfo{
		Name:  name,
		Login: login,
		Email: email,
	}

	if !s.IsTeamMember(client) {
		return nil, errors.New("User not a member of one of the required teams")
	}

	if !s.IsOrganizationMember(client) {
		return nil, errors.New("User not a member of one of the required organizations")
	}

	return userInfo, nil
}

func (s *SocialGenericOAuth) extractToken(data *UserInfoJson, token *oauth2.Token) bool {
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

	payload, err := base64.RawURLEncoding.DecodeString(matched[2])
	if err != nil {
		s.log.Error("Error base64 decoding id_token", "raw_payload", matched[2], "err", err)
		return false
	}

	err = json.Unmarshal(payload, &data)
	if err != nil {
		s.log.Error("Error decoding id_token JSON", "payload", string(payload), "err", err)
		return false
	}

	if _, err := s.extractEmail(data, payload); err != nil {
		s.log.Debug("No email found in id_token", "json", string(payload), "data", data)
		return false
	}

	s.log.Debug("Received id_token", "json", string(payload), "data", data)
	return true
}

func (s *SocialGenericOAuth) extractEmail(data *UserInfoJson, userInfoResp []byte) (string, error) {
	if data.Email != "" {
		return data.Email, nil
	}

	email, err := s.searchJSONForEmail(userInfoResp)
	if err != nil {
		s.log.Debug("Failed to search user info JSON response for e-mail", "err", err.Error())
	} else {
		return email, nil
	}
	s.log.Debug("No e-mail address found when searching user info JSON response")

	emails, ok := data.Attributes[s.emailAttributeName]
	if ok && len(emails) != 0 {
		return emails[0], nil
	}

	if data.Upn != "" {
		emailAddr, emailErr := mail.ParseAddress(data.Upn)
		if emailErr != nil {
			s.log.Debug("Failed to parse e-mail address", "email", emailAddr, "err", emailErr.Error())
		} else {
			return emailAddr.Address, nil
		}
	}

	return "", errors.New("Failed to extract e-mail address from user info response")
}

func (s *SocialGenericOAuth) extractLogin(data *UserInfoJson, email string) string {
	if data.Login != "" {
		return data.Login
	}

	if data.Username != "" {
		return data.Username
	}

	return email
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

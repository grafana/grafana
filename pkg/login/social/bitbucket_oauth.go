package social

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"net/url"
	"regexp"

	"github.com/grafana/grafana/pkg/models"

	"golang.org/x/oauth2"
)

type BitbucketOAuth struct {
	*SocialBase
	allowedDomains     []string
	apiUrl             string
	allowSignup        bool
	emailAttributeName string
	teamIds            []string
}

func (s *BitbucketOAuth) Type() int {
	return int(models.BITBUCKET)
}

func (s *BitbucketOAuth) IsEmailAllowed(email string) bool {
	return isEmailAllowed(email, s.allowedDomains)
}

func (s *BitbucketOAuth) IsSignupAllowed() bool {
	return s.allowSignup
}

func (s *BitbucketOAuth) IsTeamMember(client *http.Client) bool {
	if len(s.teamIds) == 0 {
		return false
	}

	hasTeamMembership, err := s.FetchHasTeamMemberships(client)
	if err != nil {
		return false
	}
	return hasTeamMembership
}

func (s *BitbucketOAuth) FetchPrivateEmail(client *http.Client) (string, error) {
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

func (s *BitbucketOAuth) FetchHasTeamMemberships(client *http.Client) (bool, error) {
	type ResponseData struct {
		Values []struct{} `json:"values"`
	}

	var query string
	switch len(s.teamIds) {
	case 0:
		return false, nil
	case 1:
		query = "?q=team.username=\"" + s.teamIds[0] + "\""
	default:
		query = "team.username=\"" + s.teamIds[0] + "\""
		for _, teamId := range s.teamIds[1:] {
			query += " OR team.username=\"" + teamId + "\""
		}
		query = "?q=(" + url.QueryEscape(query) + ")"
	}

	response, err := HttpGet(client, s.apiUrl+"/permissions/teams"+query)
	if err != nil {
		s.SocialBase.log.Error(err.Error())
		return false, fmt.Errorf("Error getting team memberships: %s", err)
	}

	var data ResponseData
	err = json.Unmarshal(response.Body, &data)
	if err != nil {
		return false, fmt.Errorf("Error getting team memberships: %s", err)
	}
	return len(data.Values) > 0, nil
}

type BitbucketUserInfoJson struct {
	Name        string              `json:"name"`
	DisplayName string              `json:"display_name"`
	Login       string              `json:"login"`
	Username    string              `json:"username"`
	Email       string              `json:"email"`
	Upn         string              `json:"upn"`
	Attributes  map[string][]string `json:"attributes"`
}

func (s *BitbucketOAuth) UserInfo(client *http.Client, token *oauth2.Token) (*BasicUserInfo, error) {
	var data BitbucketUserInfoJson
	var err error

	if !s.extractToken(&data, token) {
		response, err := HttpGet(client, s.apiUrl)
		if err != nil {
			return nil, fmt.Errorf("Error getting user info: %s", err)
		}

		err = json.Unmarshal(response.Body, &data)
		if err != nil {
			return nil, fmt.Errorf("Error decoding user info JSON: %s", err)
		}
	}

	name := s.extractName(&data)

	email := s.extractEmail(&data)
	if email == "" {
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

	return userInfo, nil
}

func (s *BitbucketOAuth) extractToken(data *BitbucketUserInfoJson, token *oauth2.Token) bool {
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

	err = json.Unmarshal(payload, data)
	if err != nil {
		s.log.Error("Error decoding id_token JSON", "payload", string(payload), "err", err)
		return false
	}

	email := s.extractEmail(data)
	if email == "" {
		s.log.Debug("No email found in id_token", "json", string(payload), "data", data)
		return false
	}

	s.log.Debug("Received id_token", "json", string(payload), "data", data)
	return true
}

func (s *BitbucketOAuth) extractEmail(data *BitbucketUserInfoJson) string {
	if data.Email != "" {
		return data.Email
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
	}

	return ""
}

func (s *BitbucketOAuth) extractLogin(data *BitbucketUserInfoJson, email string) string {
	if data.Login != "" {
		return data.Login
	}

	if data.Username != "" {
		return data.Username
	}

	return email
}

func (s *BitbucketOAuth) extractName(data *BitbucketUserInfoJson) string {
	if data.Name != "" {
		return data.Name
	}

	if data.DisplayName != "" {
		return data.DisplayName
	}

	return ""
}

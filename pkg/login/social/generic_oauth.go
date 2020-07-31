package social

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/jmespath/go-jmespath"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"golang.org/x/oauth2"
)

type SocialGenericOAuth struct {
	*SocialBase
	allowedOrganizations []string
	apiUrl               string
	emailAttributeName   string
	emailAttributePath   string
	roleAttributePath    string
	groupMappings        []setting.OAuthGroupMapping
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
}

func (info *UserInfoJson) String() string {
	return fmt.Sprintf(
		"Name: %s, Displayname: %s, Login: %s, Username: %s, Email: %s, Upn: %s, Attributes: %v",
		info.Name, info.DisplayName, info.Login, info.Username, info.Email, info.Upn, info.Attributes)
}

func (s *SocialGenericOAuth) UserInfo(client *http.Client, token *oauth2.Token) (*BasicUserInfo, error) {
	var data UserInfoJson
	var err error

	s.log.Debug("Getting user info")

	userInfo := &BasicUserInfo{}

	if s.extractToken(token, &data) {
		s.log.Debug("Filling user info based on OAuth token")
		if err := s.fillUserInfo(userInfo, &data); err != nil {
			return nil, err
		}
	}

	if s.extractAPI(client, &data) {
		if err := s.fillUserInfo(userInfo, &data); err != nil {
			return nil, err
		}
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

func (s *SocialGenericOAuth) fillUserInfo(userInfo *BasicUserInfo, data *UserInfoJson) error {
	if userInfo.Email == "" {
		userInfo.Email = s.extractEmail(data)
	}
	if err := s.extractOrgMemberships(data, userInfo); err != nil {
		return err
	}
	if userInfo.Name == "" {
		userInfo.Name = s.extractName(data)
	}
	if userInfo.Login == "" {
		userInfo.Login = s.extractLogin(data)
	}

	return nil
}

func (s *SocialGenericOAuth) extractToken(token *oauth2.Token, data *UserInfoJson) bool {
	s.log.Debug("Extracting user info from OAuth token")

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

	var err error
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

func (s *SocialGenericOAuth) extractAPI(client *http.Client, data *UserInfoJson) bool {
	s.log.Debug("Getting user info from API")
	rawUserInfoResponse, err := HttpGet(client, s.apiUrl)
	if err != nil {
		s.log.Debug("Error getting user info from API", "url", s.apiUrl, "error", err)
		return false
	}
	data.rawJSON = rawUserInfoResponse.Body

	err = json.Unmarshal(data.rawJSON, data)
	if err != nil {
		s.log.Error("Error decoding user info response", "raw_json", data.rawJSON, "error", err)
		data.rawJSON = []byte{}
		return false
	}

	s.log.Debug("Received user info response from API", "raw_json", string(data.rawJSON), "data", data)
	return true
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

func (s *SocialGenericOAuth) extractOrgMemberships(data *UserInfoJson, userInfo *BasicUserInfo) error {
	if userInfo.OrgMemberships == nil {
		userInfo.OrgMemberships = map[int64]models.RoleType{}
	}

	s.log.Debug("Extracting organization memberships")

	// TODO: Move unfiltered group mappings to end of list, so we can apply them deterministically

	unfiltered := []int64{}
	for i, mapping := range s.groupMappings {
		s.log.Debug("Processing group mapping", "number", i+1, "mapping", mapping)
		if mapping.Filter != "" {
			s.log.Debug("Using mapping filter", "filter", mapping.Filter)
			var val interface{}
			json.Unmarshal(data.rawJSON, &val)
			v, err := jmespath.Search(mapping.Filter, val)
			if err != nil {
				s.log.Warn("Failed to look up filter in OAuth user info", "filter", mapping.Filter, "error", err)
				continue
			}

			if match, ok := v.(bool); !ok || !match {
				s.log.Debug("Group mapping filter didn't match", "number", i+1, "filter", mapping.Filter)
				continue
			}
		}

		for orgID, roleStr := range mapping.OrgMemberships {
			role := models.RoleType(strings.Title(roleStr))
			if !role.IsValid() {
				s.log.Warn("Invalid role in org_memberships", "role", roleStr)
				continue
			}
			// Ignore this role if the user already has a more important one in the org
			if r, ok := userInfo.OrgMemberships[orgID]; ok && r != role && r.Includes(role) {
				s.log.Warn("Ignoring role since the user already has a more important role in org", "role", role,
					"orgID", orgID)
				continue
			}

			userInfo.OrgMemberships[orgID] = role
			if mapping.Filter == "" {
				s.log.Debug("Appending unfiltered", "orgID", orgID, "role", role)
				unfiltered = append(unfiltered, orgID)
			}
		}

		if mapping.IsGrafanaAdmin != nil {
			userInfo.IsGrafanaAdmin = mapping.IsGrafanaAdmin
		}

		s.log.Debug("Processed group mapping", "number", i+1, "orgMemberships", mapping.OrgMemberships,
			"isGrafanaAdmin", userInfo.IsGrafanaAdmin)
	}

	if len(userInfo.OrgMemberships) > len(unfiltered) {
		// The user has matched filtered mappings, so drop the unfiltered ones
		for _, orgID := range unfiltered {
			delete(userInfo.OrgMemberships, orgID)
		}
	}

	if s.roleAttributePath == "" {
		return nil
	}

	s.log.Debug("Trying to extract OAuth user role", "roleAttrPath", s.roleAttributePath)

	roleStr, err := s.searchJSONForAttr(s.roleAttributePath, data.rawJSON)
	if err != nil {
		s.log.Error("Failed to get role", "error", err)
		return nil
	}

	role := models.RoleType(roleStr)
	if !role.IsValid() {
		s.log.Debug("The extracted role is invalid", "roleAttrPath", s.roleAttributePath, "role", roleStr)
		return nil
	}

	// The user will be assigned a role in either the auto-assigned organization or in the default one
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

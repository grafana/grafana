package social

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"golang.org/x/oauth2"
	"gopkg.in/square/go-jose.v2/jwt"
)

type SocialOkta struct {
	*SocialBase
	apiUrl            string
	allowedGroups     []string
	roleAttributePath string
}

type OktaUserInfoJson struct {
	Name        string              `json:"name"`
	DisplayName string              `json:"display_name"`
	Login       string              `json:"login"`
	Username    string              `json:"username"`
	Email       string              `json:"email"`
	Upn         string              `json:"upn"`
	Attributes  map[string][]string `json:"attributes"`
	Groups      []string            `json:"groups"`
	rawJSON     []byte
}

type OktaClaims struct {
	ID                string `json:"sub"`
	Email             string `json:"email"`
	PreferredUsername string `json:"preferred_username"`
	Name              string `json:"name"`
}

func (claims *OktaClaims) extractEmail() string {
	if claims.Email == "" && claims.PreferredUsername != "" {
		return claims.PreferredUsername
	}

	return claims.Email
}

func (s *SocialOkta) Type() int {
	return int(models.OKTA)
}

func (s *SocialOkta) UserInfo(client *http.Client, token *oauth2.Token) (*BasicUserInfo, error) {
	idToken := token.Extra("id_token")
	if idToken == nil {
		return nil, fmt.Errorf("no id_token found")
	}

	parsedToken, err := jwt.ParseSigned(idToken.(string))
	if err != nil {
		return nil, errutil.Wrapf(err, "error parsing ID token")
	}

	var claims OktaClaims
	if err := parsedToken.UnsafeClaimsWithoutVerification(&claims); err != nil {
		return nil, errutil.Wrapf(err, "error getting claims from ID token")
	}

	var data OktaUserInfoJson
	if err := s.extractAPI(&data, client); err != nil {
		return nil, err
	}

	email := claims.extractEmail()
	if email == "" {
		return nil, errors.New("error getting user info: no email found in access token")
	}

	groups := s.GetGroups(&data)
	if !s.IsGroupMember(groups) {
		return nil, ErrMissingGroupMembership
	}

	userInfo := &BasicUserInfo{
		Id:     claims.ID,
		Name:   claims.Name,
		Email:  email,
		Login:  email,
		Groups: groups,
	}

	if err := s.extractOrgMemberships(data, userInfo); err != nil {
		return nil, err
	}

	return userInfo, nil
}

func (s *SocialOkta) extractAPI(data *OktaUserInfoJson, client *http.Client) error {
	rawUserInfoResponse, err := HttpGet(client, s.apiUrl)
	if err != nil {
		s.log.Debug("Error getting user info response", "url", s.apiUrl, "error", err)
		return errutil.Wrapf(err, "error getting user info response")
	}
	data.rawJSON = rawUserInfoResponse.Body

	err = json.Unmarshal(data.rawJSON, data)
	if err != nil {
		s.log.Debug("Error decoding user info response", "raw_json", data.rawJSON, "error", err)
		data.rawJSON = []byte{}
		return errutil.Wrapf(err, "error decoding user info response")
	}

	s.log.Debug("Received user info response", "raw_json", string(data.rawJSON), "data", data)
	return nil
}

func (s *SocialOkta) extractOrgMemberships(data OktaUserInfoJson, userInfo *BasicUserInfo) error {
	userInfo.OrgMemberships = map[int64]models.RoleType{}

	roleStr := ""
	if s.roleAttributePath != "" {
		var err error
		roleStr, err = s.searchJSONForAttr(s.roleAttributePath, data.rawJSON)
		if err != nil {
			s.log.Error("failed searching for role")
			return nil
		}
	}

	role := models.RoleType(roleStr)
	if !role.IsValid() {
		return nil
	}

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

func (s *SocialOkta) GetGroups(data *OktaUserInfoJson) []string {
	groups := make([]string, 0)
	if len(data.Groups) > 0 {
		groups = data.Groups
	}
	return groups
}

func (s *SocialOkta) IsGroupMember(groups []string) bool {
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

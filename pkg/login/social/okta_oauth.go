package social

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/models"
	"golang.org/x/oauth2"
	"gopkg.in/square/go-jose.v2/jwt"
)

type SocialOkta struct {
	*SocialBase
	apiUrl        string
	allowedGroups []string
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
		return nil, fmt.Errorf("error parsing id token: %w", err)
	}

	var claims OktaClaims
	if err := parsedToken.UnsafeClaimsWithoutVerification(&claims); err != nil {
		return nil, fmt.Errorf("error getting claims from id token: %w", err)
	}

	email := claims.extractEmail()
	if email == "" {
		return nil, errors.New("error getting user info: no email found in access token")
	}

	var data OktaUserInfoJson
	err = s.extractAPI(&data, client)
	if err != nil {
		return nil, err
	}

	groups := s.GetGroups(&data)
	if !s.IsGroupMember(groups) {
		return nil, errMissingGroupMembership
	}

	role, grafanaAdmin := s.extractRoleAndAdmin(data.rawJSON, groups)
	if s.roleAttributeStrict && !role.IsValid() {
		return nil, ErrInvalidBasicRole
	}

	var isGrafanaAdmin *bool = nil
	if s.allowAssignGrafanaAdmin {
		isGrafanaAdmin = &grafanaAdmin
	}

	return &BasicUserInfo{
		Id:             claims.ID,
		Name:           claims.Name,
		Email:          email,
		Login:          email,
		Role:           string(role),
		IsGrafanaAdmin: isGrafanaAdmin,
		Groups:         groups,
	}, nil
}

func (s *SocialOkta) extractAPI(data *OktaUserInfoJson, client *http.Client) error {
	rawUserInfoResponse, err := s.httpGet(client, s.apiUrl)
	if err != nil {
		s.log.Debug("Error getting user info response", "url", s.apiUrl, "error", err)
		return fmt.Errorf("error getting user info response: %w", err)
	}
	data.rawJSON = rawUserInfoResponse.Body

	err = json.Unmarshal(data.rawJSON, data)
	if err != nil {
		s.log.Debug("Error decoding user info response", "raw_json", data.rawJSON, "error", err)
		data.rawJSON = []byte{}
		return fmt.Errorf("error decoding user info response: %w", err)
	}

	s.log.Debug("Received user info response", "raw_json", string(data.rawJSON), "data", data)
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

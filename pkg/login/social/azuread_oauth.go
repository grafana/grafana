package social

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"

	"golang.org/x/oauth2"
	"gopkg.in/square/go-jose.v2/jwt"
)

type SocialAzureAD struct {
	*SocialBase
	allowedGroups []string
}

type azureClaims struct {
	Email             string   `json:"email"`
	PreferredUsername string   `json:"preferred_username"`
	Roles             []string `json:"roles"`
	Groups            []string `json:"groups"`
	Name              string   `json:"name"`
	ID                string   `json:"oid"`
}

func (s *SocialAzureAD) Type() int {
	return int(models.AZUREAD)
}

func (s *SocialAzureAD) UserInfo(_ *http.Client, token *oauth2.Token) (*BasicUserInfo, error) {
	idToken := token.Extra("id_token")
	if idToken == nil {
		return nil, fmt.Errorf("no id_token found")
	}

	parsedToken, err := jwt.ParseSigned(idToken.(string))
	if err != nil {
		return nil, errutil.Wrapf(err, "error parsing ID token")
	}

	var claims azureClaims
	if err := parsedToken.UnsafeClaimsWithoutVerification(&claims); err != nil {
		return nil, errutil.Wrapf(err, "error getting claims from ID token")
	}

	email := extractEmail(claims)
	if email == "" {
		return nil, errors.New("error getting user info: no email found in access token")
	}
	groups := extractGroups(claims)
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

	if err := s.extractOrgMemberships(claims, userInfo); err != nil {
		return nil, err
	}

	return userInfo, nil
}

func (s *SocialAzureAD) extractOrgMemberships(claims azureClaims, userInfo *BasicUserInfo) error {
	userInfo.OrgMemberships = map[int64]models.RoleType{}

	role := models.ROLE_VIEWER
	if len(claims.Roles) > 0 {
		roleOrder := []models.RoleType{
			models.ROLE_ADMIN,
			models.ROLE_EDITOR,
			models.ROLE_VIEWER,
		}
		for _, r := range roleOrder {
			found := false
			for _, item := range claims.Roles {
				if strings.EqualFold(item, string(r)) {
					s.log.Debug("The user has a role", "role", r)
					role = r
					found = true
					break
				}
			}
			if found {
				break
			}
		}
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

func (s *SocialAzureAD) IsGroupMember(groups []string) bool {
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

func extractEmail(claims azureClaims) string {
	if claims.Email == "" {
		if claims.PreferredUsername != "" {
			return claims.PreferredUsername
		}
	}

	return claims.Email
}

func extractGroups(claims azureClaims) []string {
	groups := make([]string, 0)
	groups = append(groups, claims.Groups...)
	return groups
}

package social

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/models"

	"golang.org/x/oauth2"
	"gopkg.in/square/go-jose.v2/jwt"
)

type SocialAzureAD struct {
	*SocialBase
	allowedDomains []string
	allowedGroups  []string
	allowSignup    bool
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

func (s *SocialAzureAD) IsEmailAllowed(email string) bool {
	return isEmailAllowed(email, s.allowedDomains)
}

func (s *SocialAzureAD) IsSignupAllowed() bool {
	return s.allowSignup
}

func (s *SocialAzureAD) UserInfo(_ *http.Client, token *oauth2.Token) (*BasicUserInfo, error) {
	idToken := token.Extra("id_token")
	if idToken == nil {
		return nil, fmt.Errorf("No id_token found")
	}

	parsedToken, err := jwt.ParseSigned(idToken.(string))
	if err != nil {
		return nil, fmt.Errorf("Error parsing id token")
	}

	var claims azureClaims
	if err := parsedToken.UnsafeClaimsWithoutVerification(&claims); err != nil {
		return nil, fmt.Errorf("Error getting claims from id token")
	}

	email := extractEmail(claims)

	if email == "" {
		return nil, errors.New("Error getting user info: No email found in access token")
	}

	role := extractRole(claims)

	groups := extractGroups(claims)
	if !s.IsGroupMember(groups) {
		return nil, ErrMissingGroupMembership
	}

	return &BasicUserInfo{
		Id:     claims.ID,
		Name:   claims.Name,
		Email:  email,
		Login:  email,
		Role:   string(role),
		Groups: groups,
	}, nil
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

func extractRole(claims azureClaims) models.RoleType {
	if len(claims.Roles) == 0 {
		return models.ROLE_VIEWER
	}

	roleOrder := []models.RoleType{
		models.ROLE_ADMIN,
		models.ROLE_EDITOR,
		models.ROLE_VIEWER,
	}

	for _, role := range roleOrder {
		if found := hasRole(claims.Roles, role); found {
			return role
		}
	}

	return models.ROLE_VIEWER
}

func hasRole(roles []string, role models.RoleType) bool {
	for _, item := range roles {
		if strings.EqualFold(item, string(role)) {
			return true
		}
	}
	return false
}

func extractGroups(claims azureClaims) []string {
	groups := make([]string, 0)
	groups = append(groups, claims.Groups...)
	return groups
}

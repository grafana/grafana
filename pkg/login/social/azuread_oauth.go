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
	allowSignup    bool
}

type AzureClaims struct {
	Email      string   `json:"email"`
	UniqueName string   `json:"unique_name"`
	Upn        string   `json:"upn"`
	Roles      []string `json:"roles"`
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

func (s *SocialAzureAD) UserInfo(client *http.Client, token *oauth2.Token) (*BasicUserInfo, error) {
	var data struct {
		Id         string `json:"id"`
		Name       string `json:"name"`
		Email      string `json:"email"`
		Upn        string `json:"upn"`
		UniqueName string `json:"unique_name"`
		Roles      string `json:"roles"`
	}

	idToken := token.Extra("id_token")
	if idToken == nil {
		return nil, fmt.Errorf("No id_token found")
	}

	parsedToken, err := jwt.ParseSigned(idToken.(string))
	if err != nil {
		return nil, fmt.Errorf("Error parsing id token")
	}

	var claims AzureClaims
	if err := parsedToken.UnsafeClaimsWithoutVerification(&claims); err != nil {
		return nil, fmt.Errorf("Error getting claims from id token")
	}

	fmt.Printf("%#v", claims)
	email := extractEmail(claims)

	if email == "" {
		return nil, errors.New("Error getting user info: No email found in access token")
	}

	role := s.extractRole(client, claims)

	return &BasicUserInfo{
		Id:    data.Id,
		Name:  data.Name,
		Email: email,
		Login: email,
		Role:  string(role),
	}, nil
}

func extractEmail(claims AzureClaims) string {

	if claims.Email == "" {
		if len(claims.Upn) > 0 {
			return claims.Upn
		}
		if len(claims.UniqueName) > 0 {
			return claims.UniqueName
		}
	}

	return claims.Email
}

func (s *SocialAzureAD) extractRole(client *http.Client, claims AzureClaims) models.RoleType {
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
		if strings.ToLower(item) == strings.ToLower(string(role)) {
			return true
		}
	}
	return false
}

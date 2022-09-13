package social

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/org"

	"golang.org/x/oauth2"
	"gopkg.in/square/go-jose.v2/jwt"
)

type SocialAzureAD struct {
	*SocialBase
	allowedGroups []string
}

type azureClaims struct {
	Email             string                 `json:"email"`
	PreferredUsername string                 `json:"preferred_username"`
	Roles             []string               `json:"roles"`
	Groups            []string               `json:"groups"`
	Name              string                 `json:"name"`
	ID                string                 `json:"oid"`
	ClaimNames        claimNames             `json:"_claim_names,omitempty"`
	ClaimSources      map[string]claimSource `json:"_claim_sources,omitempty"`
}

type claimNames struct {
	Groups string `json:"groups"`
}

type claimSource struct {
	Endpoint string `json:"endpoint"`
}

type azureAccessClaims struct {
	TenantID string `json:"tid"`
}

func (s *SocialAzureAD) Type() int {
	return int(models.AZUREAD)
}

func (s *SocialAzureAD) UserInfo(client *http.Client, token *oauth2.Token) (*BasicUserInfo, error) {
	idToken := token.Extra("id_token")
	if idToken == nil {
		return nil, ErrIDTokenNotFound
	}

	parsedToken, err := jwt.ParseSigned(idToken.(string))
	if err != nil {
		return nil, fmt.Errorf("error parsing id token: %w", err)
	}

	var claims azureClaims
	if err := parsedToken.UnsafeClaimsWithoutVerification(&claims); err != nil {
		return nil, fmt.Errorf("error getting claims from id token: %w", err)
	}

	email := claims.extractEmail()
	if email == "" {
		return nil, ErrEmailNotFound
	}

	role, grafanaAdmin := claims.extractRoleAndAdmin(s.autoAssignOrgRole, s.roleAttributeStrict)
	if role == "" {
		return nil, ErrInvalidBasicRole
	}
	logger.Debug("AzureAD OAuth: extracted role", "email", email, "role", role)

	groups, err := extractGroups(client, claims, token)
	if err != nil {
		return nil, fmt.Errorf("failed to extract groups: %w", err)
	}

	logger.Debug("AzureAD OAuth: extracted groups", "email", email, "groups", fmt.Sprintf("%v", groups))
	if !s.IsGroupMember(groups) {
		return nil, errMissingGroupMembership
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

func (claims *azureClaims) extractEmail() string {
	if claims.Email == "" {
		if claims.PreferredUsername != "" {
			return claims.PreferredUsername
		}
	}

	return claims.Email
}

// extractRoleAndAdmin extracts the role from the claims and returns the role and whether the user is a Grafana admin.
func (claims *azureClaims) extractRoleAndAdmin(autoAssignRole string, strictMode bool) (org.RoleType, bool) {
	if len(claims.Roles) == 0 {
		if strictMode {
			return org.RoleType(""), false
		}

		return org.RoleType(autoAssignRole), false
	}

	roleOrder := []org.RoleType{
		RoleGrafanaAdmin,
		org.RoleAdmin,
		org.RoleEditor,
		org.RoleViewer,
	}

	for _, role := range roleOrder {
		if found := hasRole(claims.Roles, role); found {
			if role == RoleGrafanaAdmin {
				return org.RoleAdmin, true
			}

			return role, false
		}
	}

	if strictMode {
		return org.RoleType(""), false
	}

	return org.RoleViewer, false
}

func hasRole(roles []string, role org.RoleType) bool {
	for _, item := range roles {
		if strings.EqualFold(item, string(role)) {
			return true
		}
	}

	return false
}

type getAzureGroupRequest struct {
	SecurityEnabledOnly bool `json:"securityEnabledOnly"`
}

type getAzureGroupResponse struct {
	Value []string `json:"value"`
}

func extractGroups(client *http.Client, claims azureClaims, token *oauth2.Token) ([]string, error) {
	if len(claims.Groups) > 0 {
		return claims.Groups, nil
	}

	if claims.ClaimNames.Groups == "" {
		return []string{}, nil
	}

	// If user groups exceeds 200 no groups will be found in claims.
	// See https://docs.microsoft.com/en-us/azure/active-directory/develop/id-tokens#groups-overage-claim
	endpoint := claims.ClaimSources[claims.ClaimNames.Groups].Endpoint
	if strings.Contains(endpoint, "graph.windows.net") {
		// If the endpoints provided in _claim_source is pointed to the deprecated "graph.windows.net" api
		// replace with handcrafted url to graph.microsoft.com
		// See https://docs.microsoft.com/en-us/graph/migrate-azure-ad-graph-overview
		parsedToken, err := jwt.ParseSigned(token.AccessToken)
		if err != nil {
			return nil, fmt.Errorf("error parsing id token: %w", err)
		}

		var accessClaims azureAccessClaims
		if err := parsedToken.UnsafeClaimsWithoutVerification(&accessClaims); err != nil {
			return nil, fmt.Errorf("error getting claims from access token: %w", err)
		}
		endpoint = fmt.Sprintf("https://graph.microsoft.com/v1.0/%s/users/%s/getMemberObjects", accessClaims.TenantID, claims.ID)
	}

	data, err := json.Marshal(&getAzureGroupRequest{SecurityEnabledOnly: false})
	if err != nil {
		return nil, err
	}

	res, err := client.Post(endpoint, "application/json", bytes.NewBuffer(data))
	if err != nil {
		return nil, err
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Warn("AzureAD OAuth: failed to close response body", "err", err)
		}
	}()

	if res.StatusCode != http.StatusOK {
		if res.StatusCode == http.StatusForbidden {
			logger.Warn("AzureAD OAuh: Token need GroupMember.Read.All permission to fetch all groups")
		} else {
			body, _ := io.ReadAll(res.Body)
			logger.Warn("AzureAD OAuh: could not fetch user groups", "code", res.StatusCode, "body", string(body))
		}
		return []string{}, nil
	}

	var body getAzureGroupResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, err
	}

	return body.Value, nil
}

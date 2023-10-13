package social

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	jose "github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/org"
)

type SocialAzureAD struct {
	*SocialBase
	cache                remotecache.CacheStorage
	allowedOrganizations []string
	forceUseGraphAPI     bool
	skipOrgRoleSync      bool
}

type azureClaims struct {
	Audience          string                 `json:"aud"`
	Email             string                 `json:"email"`
	PreferredUsername string                 `json:"preferred_username"`
	Roles             []string               `json:"roles"`
	Groups            []string               `json:"groups"`
	Name              string                 `json:"name"`
	ID                string                 `json:"oid"`
	ClaimNames        claimNames             `json:"_claim_names,omitempty"`
	ClaimSources      map[string]claimSource `json:"_claim_sources,omitempty"`
	TenantID          string                 `json:"tid,omitempty"`
	OAuthVersion      string                 `json:"ver,omitempty"`
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

type keySetJWKS struct {
	jose.JSONWebKeySet
}

func (s *SocialAzureAD) UserInfo(ctx context.Context, client *http.Client, token *oauth2.Token) (*BasicUserInfo, error) {
	idToken := token.Extra("id_token")
	if idToken == nil {
		return nil, ErrIDTokenNotFound
	}

	parsedToken, err := jwt.ParseSigned(idToken.(string))
	if err != nil {
		return nil, fmt.Errorf("error parsing id token: %w", err)
	}

	claims, err := s.validateClaims(ctx, client, parsedToken)
	if err != nil {
		return nil, err
	}

	email := claims.extractEmail()
	if email == "" {
		return nil, ErrEmailNotFound
	}

	// setting the role, grafanaAdmin to empty to reflect that we are not syncronizing with the external provider
	var role roletype.RoleType
	var grafanaAdmin bool
	if !s.skipOrgRoleSync {
		role, grafanaAdmin, err = s.extractRoleAndAdmin(claims)
		if err != nil {
			return nil, err
		}

		if !role.IsValid() {
			return nil, errInvalidRole.Errorf("AzureAD OAuth: invalid role %q", role)
		}
	}
	s.log.Debug("AzureAD OAuth: extracted role", "email", email, "role", role)

	groups, err := s.extractGroups(ctx, client, claims, token)
	if err != nil {
		return nil, fmt.Errorf("failed to extract groups: %w", err)
	}
	s.log.Debug("AzureAD OAuth: extracted groups", "email", email, "groups", fmt.Sprintf("%v", groups))
	if !s.isGroupMember(groups) {
		return nil, errMissingGroupMembership
	}

	var isGrafanaAdmin *bool = nil
	if s.allowAssignGrafanaAdmin {
		isGrafanaAdmin = &grafanaAdmin
	}

	if s.allowAssignGrafanaAdmin && s.skipOrgRoleSync {
		s.log.Debug("AllowAssignGrafanaAdmin and skipOrgRoleSync are both set, Grafana Admin role will not be synced, consider setting one or the other")
	}

	return &BasicUserInfo{
		Id:             claims.ID,
		Name:           claims.Name,
		Email:          email,
		Login:          email,
		Role:           role,
		IsGrafanaAdmin: isGrafanaAdmin,
		Groups:         groups,
	}, nil
}

func (s *SocialAzureAD) validateClaims(ctx context.Context, client *http.Client, parsedToken *jwt.JSONWebToken) (*azureClaims, error) {
	claims, err := s.validateIDTokenSignature(ctx, client, parsedToken)
	if err != nil {
		return nil, fmt.Errorf("error getting claims from id token: %w", err)
	}

	if claims.OAuthVersion == "1.0" {
		return nil, &Error{"AzureAD OAuth: version 1.0 is not supported. Please ensure the auth_url and token_url are set to the v2.0 endpoints."}
	}

	s.log.Debug("Validating audience", "audience", claims.Audience, "client_id", s.ClientID)
	if claims.Audience != s.ClientID {
		return nil, &Error{"AzureAD OAuth: audience mismatch"}
	}

	s.log.Debug("Validating tenant", "tenant", claims.TenantID, "allowed_tenants", s.allowedOrganizations)
	if !s.isAllowedTenant(claims.TenantID) {
		return nil, &Error{"AzureAD OAuth: tenant mismatch"}
	}
	return claims, nil
}

func (s *SocialAzureAD) validateIDTokenSignature(ctx context.Context, client *http.Client, parsedToken *jwt.JSONWebToken) (*azureClaims, error) {
	var claims azureClaims

	jwksFuncs := []func(ctx context.Context, client *http.Client, authURL string) (*keySetJWKS, time.Duration, error){
		s.retrieveJWKSFromCache, s.retrieveSpecificJWKS, s.retrieveGeneralJWKS,
	}

	keyID := parsedToken.Headers[0].KeyID

	for _, jwksFunc := range jwksFuncs {
		keyset, expiry, err := jwksFunc(ctx, client, s.Endpoint.AuthURL)
		if err != nil {
			return nil, fmt.Errorf("error retrieving jwks: %w", err)
		}
		var errClaims error
		keys := keyset.Key(keyID)
		for _, key := range keys {
			s.log.Debug("AzureAD OAuth: trying to parse token with key", "kid", key.KeyID)
			if errClaims = parsedToken.Claims(key, &claims); errClaims == nil {
				if expiry != 0 {
					s.log.Debug("AzureAD OAuth: caching key set", "kid", key.KeyID, "expiry", expiry)
					if err := s.cacheJWKS(ctx, keyset, expiry); err != nil {
						s.log.Warn("Failed to set key set in cache", "err", err)
					}
				}
				return &claims, nil
			} else {
				s.log.Warn("AzureAD OAuth: failed to parse token with key", "kid", key.KeyID, "err", errClaims)
			}
		}
	}

	s.log.Warn("AzureAD OAuth: signing key not found", "kid", keyID)

	return nil, &Error{"AzureAD OAuth: signing key not found"}
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
func (s *SocialAzureAD) extractRoleAndAdmin(claims *azureClaims) (org.RoleType, bool, error) {
	if len(claims.Roles) == 0 {
		if s.roleAttributeStrict {
			return "", false, errRoleAttributeStrictViolation.Errorf("AzureAD OAuth: unset role")
		}
		return s.defaultRole(), false, nil
	}

	roleOrder := []org.RoleType{RoleGrafanaAdmin, org.RoleAdmin, org.RoleEditor,
		org.RoleViewer, org.RoleNone}
	for _, role := range roleOrder {
		if found := hasRole(claims.Roles, role); found {
			if role == RoleGrafanaAdmin {
				return org.RoleAdmin, true, nil
			}

			return role, false, nil
		}
	}

	if s.roleAttributeStrict {
		return "", false, errRoleAttributeStrictViolation.Errorf("AzureAD OAuth: idP did not return a valid role %q", claims.Roles)
	}

	return s.defaultRole(), false, nil
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

// extractGroups retrieves groups from the claims.
// Note: If user groups exceeds 200 no groups will be found in claims and URL to target the Graph API will be
// given instead.
// See https://docs.microsoft.com/en-us/azure/active-directory/develop/id-tokens#groups-overage-claim
func (s *SocialAzureAD) extractGroups(ctx context.Context, client *http.Client, claims *azureClaims, token *oauth2.Token) ([]string, error) {
	if !s.forceUseGraphAPI {
		s.log.Debug("Checking the claim for groups")
		if len(claims.Groups) > 0 {
			return claims.Groups, nil
		}

		if claims.ClaimNames.Groups == "" {
			return []string{}, nil
		}
	}

	// Fallback to the Graph API
	endpoints, errBuildGraphURI := s.groupsGraphAPIURL(claims, token)
	if errBuildGraphURI != nil {
		return nil, errBuildGraphURI
	}

	var err error
	for _, endpoint := range endpoints {
		var groups []string
		s.log.Debug("AzureAD OAuth: fetching groups", "endpoint", endpoint)
		groups, err = s.fetchGroups(ctx, client, endpoint)
		if err != nil {
			s.log.Debug("AzureAD OAuth: failed to fetch groups", "endpoint", endpoint, "err", err)
			continue
		}
		return groups, nil
	}
	return []string{}, err
}

func (s *SocialAzureAD) fetchGroups(ctx context.Context, client *http.Client, endpoint string) ([]string, error) {
	data, err := json.Marshal(&getAzureGroupRequest{SecurityEnabledOnly: false})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewBuffer(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			s.log.Warn("AzureAD OAuth: failed to close response body", "err", err, "endpoint", endpoint)
		}
	}()

	if res.StatusCode != http.StatusOK {
		if res.StatusCode == http.StatusForbidden {
			if strings.Contains(endpoint, "graph.windows.net") {
				s.log.Warn("AzureAD OAuh: Token need Directory.Read.All Or Directory.ReadWrite.All permission to fetch all groups", "endpoint", endpoint)
			} else {
				s.log.Warn("AzureAD OAuh: Token need GroupMember.Read.All permission to fetch all groups", "endpoint", endpoint)
			}
		} else {
			body, _ := io.ReadAll(res.Body)
			s.log.Warn("AzureAD OAuh: could not fetch user groups", "endpoint", endpoint, "code", res.StatusCode, "body", string(body))
		}
		return nil, errors.New(fmt.Sprintf("could not fetch user groups; endpoint: %s code: %d", endpoint, res.StatusCode))
	}

	var body getAzureGroupResponse
	if err = json.NewDecoder(res.Body).Decode(&body); err != nil {
		s.log.Debug("failed to decode response body", "err", err, "endpoint", endpoint)
		return nil, err
	}

	return body.Value, nil
}

// groupsGraphAPIURL returns a list of possible graph endpoints:
// it returns the Microsoft Graph API URL to fetch user groups from the _claim_sources if present,
// otherwise it generates a handcrafted URL.
// If the URL from claims is the deprecated "graph.windows.net" api URL, return that as well as the handcrafted URL.
func (s *SocialAzureAD) groupsGraphAPIURL(claims *azureClaims, token *oauth2.Token) ([]string, error) {
	var endpoints []string
	// First check if an endpoint was specified in the claims
	if claims.ClaimNames.Groups != "" {
		endpointFromClaims := claims.ClaimSources[claims.ClaimNames.Groups].Endpoint
		endpoints = append(endpoints, endpointFromClaims)
		s.log.Debug(fmt.Sprintf("endpoint to fetch groups specified in the claims: %s", endpointFromClaims))
	}

	// If no endpoint was specified or if the endpoints provided in _claim_source is pointing to the deprecated
	// "graph.windows.net" api, use a handcrafted url to graph.microsoft.com
	// See https://docs.microsoft.com/en-us/graph/migrate-azure-ad-graph-overview
	if len(endpoints) == 0 || strings.Contains(endpoints[0], "graph.windows.net") {
		tenantID := claims.TenantID
		// If tenantID wasn't found in the id_token, parse access token
		if tenantID == "" {
			parsedToken, err := jwt.ParseSigned(token.AccessToken)
			if err != nil {
				return []string{}, fmt.Errorf("error parsing access token: %w", err)
			}

			var accessClaims azureAccessClaims
			if err := parsedToken.UnsafeClaimsWithoutVerification(&accessClaims); err != nil {
				return []string{}, fmt.Errorf("error getting claims from access token: %w", err)
			}
			tenantID = accessClaims.TenantID
		}

		craftedEndpoint := fmt.Sprintf("https://graph.microsoft.com/v1.0/%s/users/%s/getMemberObjects", tenantID, claims.ID)
		s.log.Debug(fmt.Sprintf("handcrafted endpoint to fetch groups: %s", craftedEndpoint))
		// Insert the handcrafted endpoint at the beginning of the slice so that we try it first
		endpoints = append([]string{craftedEndpoint}, endpoints...)
	}
	return endpoints, nil
}

func (s *SocialAzureAD) SupportBundleContent(bf *bytes.Buffer) error {
	bf.WriteString("## AzureAD specific configuration\n\n")
	bf.WriteString("```ini\n")
	bf.WriteString(fmt.Sprintf("allowed_groups = %v\n", s.allowedGroups))
	bf.WriteString(fmt.Sprintf("forceUseGraphAPI = %v\n", s.forceUseGraphAPI))
	bf.WriteString("```\n\n")

	return s.SocialBase.SupportBundleContent(bf)
}

func (s *SocialAzureAD) isAllowedTenant(tenantID string) bool {
	if len(s.allowedOrganizations) == 0 {
		s.log.Warn("No allowed organizations specified, all tenants are allowed. Configure allowed_organizations to restrict access")
		return true
	}

	for _, t := range s.allowedOrganizations {
		if t == tenantID {
			return true
		}
	}
	return false
}

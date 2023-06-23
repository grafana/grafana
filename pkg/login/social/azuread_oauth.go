package social

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	jose "github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/org"
)

const (
	azureCacheKeyPrefix    = "azuread_oauth_jwks-"
	defaultCacheExpiration = 24 * time.Hour
	tenantRegex            = `^https:\/\/login\.microsoftonline\.com\/(?P<tenant>[a-zA-Z0-9\-]+)\/oauth2\/v2\.0\/authorize$`
)

type SocialAzureAD struct {
	*SocialBase
	cache                remotecache.CacheStorage
	allowedOrganizations []string
	allowedGroups        []string
	forceUseGraphAPI     bool
	skipOrgRoleSync      bool
	compiledTenantRegex  *regexp.Regexp
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

	var claims azureClaims

	keyset, err := s.retrieveJWKS(client)
	if err != nil {
		return nil, fmt.Errorf("error retrieving jwks: %w", err)
	}

	var errClaims error
	keyID := parsedToken.Headers[0].KeyID
	keys := keyset.Key(keyID)
	if len(keys) == 0 {
		s.log.Warn("AzureAD OAuth: signing key not found",
			"kid", keyID,
			"keys", fmt.Sprintf("%v", keyset.Keys))
		return nil, &Error{"AzureAD OAuth: signing key not found"}
	}
	for _, key := range keys {
		s.log.Debug("AzureAD OAuth: trying to parse token with key", "kid", key.KeyID)
		if errClaims = parsedToken.Claims(key, &claims); errClaims == nil {
			break
		}
	}

	if errClaims != nil {
		return nil, fmt.Errorf("error getting claims from id token: %w", errClaims)
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

	email := claims.extractEmail()
	if email == "" {
		return nil, ErrEmailNotFound
	}

	// setting the role, grafanaAdmin to empty to reflect that we are not syncronizing with the external provider
	var role roletype.RoleType
	var grafanaAdmin bool
	if !s.skipOrgRoleSync {
		role, grafanaAdmin = s.extractRoleAndAdmin(&claims)
	}
	if s.roleAttributeStrict && !role.IsValid() {
		return nil, &InvalidBasicRoleError{idP: "Azure", assignedRole: string(role)}
	}
	s.log.Debug("AzureAD OAuth: extracted role", "email", email, "role", role)

	groups, err := s.extractGroups(ctx, client, claims, token)
	if err != nil {
		return nil, fmt.Errorf("failed to extract groups: %w", err)
	}
	s.log.Debug("AzureAD OAuth: extracted groups", "email", email, "groups", fmt.Sprintf("%v", groups))
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
		Role:           role,
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
func (s *SocialAzureAD) extractRoleAndAdmin(claims *azureClaims) (org.RoleType, bool) {
	if len(claims.Roles) == 0 {
		return s.defaultRole(false), false
	}

	roleOrder := []org.RoleType{RoleGrafanaAdmin, org.RoleAdmin, org.RoleEditor, org.RoleViewer}
	for _, role := range roleOrder {
		if found := hasRole(claims.Roles, role); found {
			if role == RoleGrafanaAdmin {
				return org.RoleAdmin, true
			}

			return role, false
		}
	}

	return s.defaultRole(false), false
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
func (s *SocialAzureAD) extractGroups(ctx context.Context, client *http.Client, claims azureClaims, token *oauth2.Token) ([]string, error) {
	if !s.forceUseGraphAPI {
		s.log.Debug("checking the claim for groups")
		if len(claims.Groups) > 0 {
			return claims.Groups, nil
		}

		if claims.ClaimNames.Groups == "" {
			return []string{}, nil
		}
	}

	// Fallback to the Graph API
	endpoint, errBuildGraphURI := s.groupsGraphAPIURL(claims, token)
	if errBuildGraphURI != nil {
		return nil, errBuildGraphURI
	}

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
			s.log.Warn("AzureAD OAuth: failed to close response body", "err", err)
		}
	}()

	if res.StatusCode != http.StatusOK {
		if res.StatusCode == http.StatusForbidden {
			s.log.Warn("AzureAD OAuh: Token need GroupMember.Read.All permission to fetch all groups")
		} else {
			body, _ := io.ReadAll(res.Body)
			s.log.Warn("AzureAD OAuh: could not fetch user groups", "code", res.StatusCode, "body", string(body))
		}
		return []string{}, nil
	}

	var body getAzureGroupResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, err
	}

	return body.Value, nil
}

// groupsGraphAPIURL retrieves the Microsoft Graph API URL to fetch user groups from the _claim_sources if present
// otherwise it generates an handcrafted URL.
func (s *SocialAzureAD) groupsGraphAPIURL(claims azureClaims, token *oauth2.Token) (string, error) {
	var endpoint string
	// First check if an endpoint was specified in the claims
	if claims.ClaimNames.Groups != "" {
		endpoint = claims.ClaimSources[claims.ClaimNames.Groups].Endpoint
		s.log.Debug(fmt.Sprintf("endpoint to fetch groups specified in the claims: %s", endpoint))
	}

	// If no endpoint was specified or if the endpoints provided in _claim_source is pointing to the deprecated
	// "graph.windows.net" api, use an handcrafted url to graph.microsoft.com
	// See https://docs.microsoft.com/en-us/graph/migrate-azure-ad-graph-overview
	if endpoint == "" || strings.Contains(endpoint, "graph.windows.net") {
		tenantID := claims.TenantID
		// If tenantID wasn't found in the id_token, parse access token
		if tenantID == "" {
			parsedToken, err := jwt.ParseSigned(token.AccessToken)
			if err != nil {
				return "", fmt.Errorf("error parsing access token: %w", err)
			}

			var accessClaims azureAccessClaims
			if err := parsedToken.UnsafeClaimsWithoutVerification(&accessClaims); err != nil {
				return "", fmt.Errorf("error getting claims from access token: %w", err)
			}
			tenantID = accessClaims.TenantID
		}

		endpoint = fmt.Sprintf("https://graph.microsoft.com/v1.0/%s/users/%s/getMemberObjects", tenantID, claims.ID)
		s.log.Debug(fmt.Sprintf("handcrafted endpoint to fetch groups: %s", endpoint))
	}
	return endpoint, nil
}

func (s *SocialAzureAD) SupportBundleContent(bf *bytes.Buffer) error {
	bf.WriteString("## AzureAD specific configuration\n\n")
	bf.WriteString("```ini\n")
	bf.WriteString(fmt.Sprintf("allowed_groups = %v\n", s.allowedGroups))
	bf.WriteString(fmt.Sprintf("forceUseGraphAPI = %v\n", s.forceUseGraphAPI))
	bf.WriteString("```\n\n")

	return s.SocialBase.SupportBundleContent(bf)
}

func (s *SocialAzureAD) extractTenantID(authURL string) (string, error) {
	if s.compiledTenantRegex == nil {
		compiledTenantRegex, err := regexp.Compile(`https://login.microsoftonline.com/([^/]+)/oauth2`)
		if err != nil {
			return "", err
		}
		s.compiledTenantRegex = compiledTenantRegex
	}

	matches := s.compiledTenantRegex.FindStringSubmatch(authURL)
	if len(matches) < 2 {
		return "", fmt.Errorf("unable to extract tenant ID from URL")
	}
	return matches[1], nil
}

func (s *SocialAzureAD) retrieveJWKS(client *http.Client) (*jose.JSONWebKeySet, error) {
	var jwks keySetJWKS
	// https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize retrieve organizations
	// https://login.microsoftonline.com/xxx/oauth2/v2.0/authorize retrieve specific tenant xxx

	tenant_id, err := s.extractTenantID(s.Endpoint.AuthURL)
	if err != nil {
		return nil, err
	}

	// example: azuread_oauth_jwks-33121321nUd
	cacheKey := azureCacheKeyPrefix + tenant_id

	// TODO: propagate context
	if val, err := s.cache.Get(context.Background(), cacheKey); err == nil {
		err := json.Unmarshal(val, &jwks)
		return &jwks.JSONWebKeySet, err
	} else {
		s.log.Debug("Keyset not found in cache", "err", err)
	}

	// TODO: allow setting well-known endpoint and retrieve from there
	keysetURL := strings.Replace(s.Endpoint.AuthURL, "/oauth2/v2.0/authorize", "/discovery/v2.0/keys", 1)

	resp, err := s.httpGet(context.Background(), client, keysetURL)
	if err != nil {
		return nil, err
	}

	bytesReader := bytes.NewReader(resp.Body)
	var jsonBuf bytes.Buffer
	if err := json.NewDecoder(io.TeeReader(bytesReader, &jsonBuf)).Decode(&jwks); err != nil {
		return nil, err
	}

	cacheExpiration := getCacheExpiration(resp.Headers.Get("cache-control"))
	s.log.Debug("Setting key set in cache", "url", keysetURL, "cache-key", cacheKey,
		"cacheExpiration", cacheExpiration)

	if err := s.cache.Set(context.Background(), cacheKey, jsonBuf.Bytes(), cacheExpiration); err != nil {
		s.log.Warn("Failed to set key set in cache", "url", keysetURL, "cache-key", cacheKey, "err", err)
	}

	return &jwks.JSONWebKeySet, nil
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

func getCacheExpiration(header string) time.Duration {
	if header == "" {
		return defaultCacheExpiration
	}

	// Cache-Control: public, max-age=14400
	cacheControl := strings.Split(header, ",")
	for _, v := range cacheControl {
		if strings.Contains(v, "max-age") {
			parts := strings.Split(v, "=")
			if len(parts) == 2 {
				seconds, err := strconv.Atoi(parts[1])
				if err != nil {
					return defaultCacheExpiration
				}
				return time.Duration(seconds) * time.Second
			}
		}
	}

	return defaultCacheExpiration
}

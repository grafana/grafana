package connectors

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	jose "github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/google/uuid"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	ssoModels "github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/validation"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const forceUseGraphAPIKey = "force_use_graph_api" // #nosec G101 not a hardcoded credential

var (
	ExtraAzureADSettingKeys = []string{forceUseGraphAPIKey, allowedOrganizationsKey}
	errAzureADMissingGroups = &SocialError{"either the user does not have any group membership or the groups claim is missing from the token."}
)

var _ social.SocialConnector = (*SocialAzureAD)(nil)
var _ ssosettings.Reloadable = (*SocialAzureAD)(nil)

type SocialAzureAD struct {
	*SocialBase
	cache                remotecache.CacheStorage
	allowedOrganizations []string
	forceUseGraphAPI     bool
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

func NewAzureADProvider(info *social.OAuthInfo, cfg *setting.Cfg, ssoSettings ssosettings.Service, features featuremgmt.FeatureToggles, cache remotecache.CacheStorage) *SocialAzureAD {
	provider := &SocialAzureAD{
		SocialBase:           newSocialBase(social.AzureADProviderName, info, features, cfg),
		cache:                cache,
		allowedOrganizations: util.SplitString(info.Extra[allowedOrganizationsKey]),
		forceUseGraphAPI:     MustBool(info.Extra[forceUseGraphAPIKey], false),
	}

	if info.UseRefreshToken {
		appendUniqueScope(provider.Config, social.OfflineAccessScope)
	}

	if features.IsEnabledGlobally(featuremgmt.FlagSsoSettingsApi) {
		ssoSettings.RegisterReloadable(social.AzureADProviderName, provider)
	}

	return provider
}

func (s *SocialAzureAD) UserInfo(ctx context.Context, client *http.Client, token *oauth2.Token) (*social.BasicUserInfo, error) {
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

	info := s.GetOAuthInfo()

	// setting the role, grafanaAdmin to empty to reflect that we are not syncronizing with the external provider
	var role roletype.RoleType
	var grafanaAdmin bool
	if !info.SkipOrgRoleSync {
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
		if len(groups) == 0 {
			// either they do not have a group or misconfiguration
			return nil, errAzureADMissingGroups
		}
		// user is not a member of any of the allowed groups
		return nil, errMissingGroupMembership
	}

	var isGrafanaAdmin *bool = nil
	if info.AllowAssignGrafanaAdmin {
		isGrafanaAdmin = &grafanaAdmin
	}

	if info.AllowAssignGrafanaAdmin && info.SkipOrgRoleSync {
		s.log.Debug("AllowAssignGrafanaAdmin and skipOrgRoleSync are both set, Grafana Admin role will not be synced, consider setting one or the other")
	}

	return &social.BasicUserInfo{
		Id:             claims.ID,
		Name:           claims.Name,
		Email:          email,
		Login:          email,
		Role:           role,
		IsGrafanaAdmin: isGrafanaAdmin,
		Groups:         groups,
	}, nil
}

func (s *SocialAzureAD) Reload(ctx context.Context, settings ssoModels.SSOSettings) error {
	newInfo, err := CreateOAuthInfoFromKeyValues(settings.Settings)
	if err != nil {
		return ssosettings.ErrInvalidSettings.Errorf("SSO settings map cannot be converted to OAuthInfo: %v", err)
	}

	s.reloadMutex.Lock()
	defer s.reloadMutex.Unlock()

	s.updateInfo(social.AzureADProviderName, newInfo)

	if newInfo.UseRefreshToken {
		appendUniqueScope(s.Config, social.OfflineAccessScope)
	}

	s.allowedOrganizations = util.SplitString(newInfo.Extra[allowedOrganizationsKey])
	s.forceUseGraphAPI = MustBool(newInfo.Extra[forceUseGraphAPIKey], false)

	return nil
}

func (s *SocialAzureAD) Validate(ctx context.Context, settings ssoModels.SSOSettings, requester identity.Requester) error {
	info, err := CreateOAuthInfoFromKeyValues(settings.Settings)
	if err != nil {
		return ssosettings.ErrInvalidSettings.Errorf("SSO settings map cannot be converted to OAuthInfo: %v", err)
	}

	err = validateInfo(info, requester)
	if err != nil {
		return err
	}

	return validation.Validate(info, requester,
		validateAllowedGroups,
		validation.RequiredUrlValidator(info.AuthUrl, "Auth URL"),
		validation.RequiredUrlValidator(info.TokenUrl, "Token URL"))
}

func validateAllowedGroups(info *social.OAuthInfo, requester identity.Requester) error {
	for _, groupId := range info.AllowedGroups {
		_, err := uuid.Parse(groupId)
		if err != nil {
			return ssosettings.ErrInvalidOAuthConfig("One or more of the Allowed groups are not in the correct format. Allowed groups should be a list of Object Ids.")
		}
	}
	return nil
}

func (s *SocialAzureAD) validateClaims(ctx context.Context, client *http.Client, parsedToken *jwt.JSONWebToken) (*azureClaims, error) {
	claims, err := s.validateIDTokenSignature(ctx, client, parsedToken)
	if err != nil {
		return nil, fmt.Errorf("error getting claims from id token: %w", err)
	}

	if claims.OAuthVersion == "1.0" {
		return nil, &SocialError{"AzureAD OAuth: version 1.0 is not supported. Please ensure the auth_url and token_url are set to the v2.0 endpoints."}
	}

	s.log.Debug("Validating audience", "audience", claims.Audience, "client_id", s.ClientID)
	if claims.Audience != s.ClientID {
		return nil, &SocialError{"AzureAD OAuth: audience mismatch"}
	}

	s.log.Debug("Validating tenant", "tenant", claims.TenantID, "allowed_tenants", s.allowedOrganizations)
	if !s.isAllowedTenant(claims.TenantID) {
		return nil, &SocialError{"AzureAD OAuth: tenant mismatch"}
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

	return nil, &SocialError{"AzureAD OAuth: signing key not found"}
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
	info := s.GetOAuthInfo()

	if len(claims.Roles) == 0 {
		if info.RoleAttributeStrict {
			return "", false, errRoleAttributeStrictViolation.Errorf("AzureAD OAuth: unset role")
		}
		return s.defaultRole(), false, nil
	}

	roleOrder := []org.RoleType{social.RoleGrafanaAdmin, org.RoleAdmin, org.RoleEditor,
		org.RoleViewer, org.RoleNone}
	for _, role := range roleOrder {
		if found := hasRole(claims.Roles, role); found {
			if role == social.RoleGrafanaAdmin {
				return org.RoleAdmin, true, nil
			}

			return role, false, nil
		}
	}

	if info.RoleAttributeStrict {
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
//
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
			s.log.Warn("AzureAD OAuth: Token need GroupMember.Read.All permission to fetch all groups")
		} else {
			body, _ := io.ReadAll(res.Body)
			s.log.Warn("AzureAD OAuth: could not fetch user groups", "code", res.StatusCode, "body", string(body))
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
func (s *SocialAzureAD) groupsGraphAPIURL(claims *azureClaims, token *oauth2.Token) (string, error) {
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
	info := s.GetOAuthInfo()

	bf.WriteString("## AzureAD specific configuration\n\n")
	bf.WriteString("```ini\n")
	bf.WriteString(fmt.Sprintf("allowed_groups = %v\n", info.AllowedGroups))
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

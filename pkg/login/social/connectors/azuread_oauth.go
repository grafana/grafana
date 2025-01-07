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

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	jose "github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/google/uuid"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/login/social"
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
	ExtraAzureADSettingKeys = map[string]ExtraKeyInfo{
		forceUseGraphAPIKey:     {Type: Bool, DefaultValue: false},
		allowedOrganizationsKey: {Type: String},
	}
	errAzureADMissingGroups = &SocialError{"either the user does not have any group membership or the groups claim is missing from the token."}
)

// List of supported audiences in Azure
var supportedFederatedCredentialAudiences = []string{
	"api://AzureADTokenExchange",      // Public
	"api://AzureADTokenExchangeUSGov", // US Gov
	"api://AzureADTokenExchangeChina", // Mooncake
	"api://AzureADTokenExchangeUSNat", // USNat
	"api://AzureADTokenExchangeUSSec"} // USSec

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

func NewAzureADProvider(info *social.OAuthInfo, cfg *setting.Cfg, orgRoleMapper *OrgRoleMapper, ssoSettings ssosettings.Service, features featuremgmt.FeatureToggles, cache remotecache.CacheStorage) *SocialAzureAD {
	provider := &SocialAzureAD{
		SocialBase:           newSocialBase(social.AzureADProviderName, orgRoleMapper, info, features, cfg),
		cache:                cache,
		allowedOrganizations: util.SplitString(info.Extra[allowedOrganizationsKey]),
		forceUseGraphAPI:     MustBool(info.Extra[forceUseGraphAPIKey], ExtraAzureADSettingKeys[forceUseGraphAPIKey].DefaultValue.(bool)),
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
	s.reloadMutex.RLock()
	defer s.reloadMutex.RUnlock()

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

	groups, err := s.extractGroups(ctx, client, claims, token)
	if err != nil {
		return nil, fmt.Errorf("failed to extract groups: %w", err)
	}

	s.log.Debug("AzureAD OAuth: extracted groups", "email", email, "groups", fmt.Sprintf("%v", groups))

	userInfo := &social.BasicUserInfo{
		Id:     claims.ID,
		Name:   claims.Name,
		Email:  email,
		Login:  email,
		Groups: groups,
	}

	if !s.info.SkipOrgRoleSync {
		directlyMappedRole, grafanaAdmin := s.extractRoleAndAdminOptional(claims)

		s.log.Debug("AzureAD OAuth: extracted role", "email", email, "role", directlyMappedRole)

		if s.info.AllowAssignGrafanaAdmin {
			userInfo.IsGrafanaAdmin = &grafanaAdmin
		}

		userInfo.OrgRoles = s.orgRoleMapper.MapOrgRoles(s.orgMappingCfg, userInfo.Groups, directlyMappedRole)
		if s.info.RoleAttributeStrict && len(userInfo.OrgRoles) == 0 {
			return nil, errRoleAttributeStrictViolation.Errorf("could not evaluate any valid roles using IdP provided data")
		}

		s.log.Debug("AzureAD OAuth: mapped org roles", "email", email, "roles", fmt.Sprintf("%v", userInfo.OrgRoles))
	}

	if s.info.AllowAssignGrafanaAdmin && s.info.SkipOrgRoleSync {
		s.log.Debug("AllowAssignGrafanaAdmin and skipOrgRoleSync are both set, Grafana Admin role will not be synced, consider setting one or the other")
	}

	if !s.isGroupMember(groups) {
		if len(groups) == 0 {
			// either they do not have a group or misconfiguration
			return nil, errAzureADMissingGroups
		}
		// user is not a member of any of the allowed groups
		return nil, errMissingGroupMembership
	}

	return userInfo, nil
}

func (s *SocialAzureAD) Exchange(ctx context.Context, code string, authOptions ...oauth2.AuthCodeOption) (*oauth2.Token, error) {
	s.reloadMutex.RLock()
	defer s.reloadMutex.RUnlock()

	switch s.info.ClientAuthentication {
	case social.ManagedIdentity:
		// Generate client assertion
		clientAssertion, err := s.managedIdentityCallback(ctx)
		if err != nil {
			return nil, err
		}

		// Set client assertion parameters
		authOptions = append(authOptions,
			oauth2.SetAuthURLParam("client_assertion", clientAssertion),
			oauth2.SetAuthURLParam("client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"),
		)

	case social.ClientSecretPost:
		// Default behavior for ClientSecretPost, no additional setup needed

	default:
		return nil, fmt.Errorf("invalid client authentication method: %s", s.info.ClientAuthentication)
	}

	// Default token exchange
	return s.Config.Exchange(ctx, code, authOptions...)
}

// ManagedIdentityCallback retrieves a token using the managed identity credential of the Azure service.
func (s *SocialAzureAD) managedIdentityCallback(ctx context.Context) (string, error) {
	// Validate required fields for Managed Identity authentication
	if s.info.ManagedIdentityClientID == "" {
		return "", fmt.Errorf("ManagedIdentityClientID is required for Managed Identity authentication")
	}
	if s.info.FederatedCredentialAudience == "" {
		return "", fmt.Errorf("FederatedCredentialAudience is required for Managed Identity authentication")
	}

	// Prepare Managed Identity Credential
	mic, err := azidentity.NewManagedIdentityCredential(&azidentity.ManagedIdentityCredentialOptions{
		ID: azidentity.ClientID(s.info.ManagedIdentityClientID),
	})
	if err != nil {
		return "", fmt.Errorf("error constructing managed identity credential: %w", err)
	}

	// Request token and return
	tk, err := mic.GetToken(ctx, policy.TokenRequestOptions{
		Scopes: []string{fmt.Sprintf("%s/.default", s.info.FederatedCredentialAudience)},
	})
	if err != nil {
		return "", fmt.Errorf("error getting managed identity token: %w", err)
	}

	return tk.Token, nil
}

func (s *SocialAzureAD) Reload(ctx context.Context, settings ssoModels.SSOSettings) error {
	newInfo, err := CreateOAuthInfoFromKeyValues(settings.Settings)
	if err != nil {
		return ssosettings.ErrInvalidSettings.Errorf("SSO settings map cannot be converted to OAuthInfo: %v", err)
	}

	s.reloadMutex.Lock()
	defer s.reloadMutex.Unlock()

	s.updateInfo(ctx, social.AzureADProviderName, newInfo)

	if newInfo.UseRefreshToken {
		appendUniqueScope(s.Config, social.OfflineAccessScope)
	}

	s.allowedOrganizations = util.SplitString(newInfo.Extra[allowedOrganizationsKey])
	s.forceUseGraphAPI = MustBool(newInfo.Extra[forceUseGraphAPIKey], false)

	return nil
}

func (s *SocialAzureAD) Validate(ctx context.Context, newSettings ssoModels.SSOSettings, oldSettings ssoModels.SSOSettings, requester identity.Requester) error {
	info, err := CreateOAuthInfoFromKeyValues(newSettings.Settings)
	if err != nil {
		return ssosettings.ErrInvalidSettings.Errorf("SSO settings map cannot be converted to OAuthInfo: %v", err)
	}

	oldInfo, err := CreateOAuthInfoFromKeyValues(oldSettings.Settings)
	if err != nil {
		oldInfo = &social.OAuthInfo{}
	}

	err = validateInfo(info, oldInfo, requester)
	if err != nil {
		return err
	}

	return validation.Validate(info, requester,
		validateClientAuthentication,
		validateFederatedCredentialAudience,
		validateAllowedGroups,
		validation.MustBeEmptyValidator(info.ApiUrl, "API URL"),
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

func validateFederatedCredentialAudience(info *social.OAuthInfo, requester identity.Requester) error {
	if info.ClientAuthentication != social.ManagedIdentity {
		return nil
	}
	for _, supportedFederatedCredentialAudience := range supportedFederatedCredentialAudiences {
		if info.FederatedCredentialAudience == supportedFederatedCredentialAudience {
			return nil
		}
	}
	return ssosettings.ErrInvalidOAuthConfig("FIC audience is not a supported audience.")
}

func validateClientAuthentication(info *social.OAuthInfo, requester identity.Requester) error {
	switch info.ClientAuthentication {
	case social.ManagedIdentity:
		if info.ManagedIdentityClientID == "" {
			return ssosettings.ErrInvalidOAuthConfig("FIC managed identity client Id is required for Managed identity authentication.")
		}
		if info.FederatedCredentialAudience == "" {
			return ssosettings.ErrInvalidOAuthConfig("FIC audience is required for Managed identity authentication.")
		}
		return nil

	case social.ClientSecretPost:
		if info.ClientSecret == "" {
			return ssosettings.ErrInvalidOAuthConfig("Client secret is required for Client secret authentication.")
		}
		return nil

	default:
		return ssosettings.ErrInvalidOAuthConfig("Invalid client authentication method.")
	}
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
func (s *SocialAzureAD) extractRoleAndAdminOptional(claims *azureClaims) (org.RoleType, bool) {
	if len(claims.Roles) == 0 {
		return "", false
	}

	roleOrder := []org.RoleType{social.RoleGrafanaAdmin, org.RoleAdmin, org.RoleEditor,
		org.RoleViewer, org.RoleNone}
	for _, role := range roleOrder {
		if found := hasRole(claims.Roles, role); found {
			if role == social.RoleGrafanaAdmin {
				return org.RoleAdmin, true
			}

			return role, false
		}
	}

	return "", false
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
	// See https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference#groups-overage-claim
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
	s.reloadMutex.RLock()
	defer s.reloadMutex.RUnlock()

	bf.WriteString("## AzureAD specific configuration\n\n")
	bf.WriteString("```ini\n")
	bf.WriteString(fmt.Sprintf("allowed_groups = %v\n", s.info.AllowedGroups))
	bf.WriteString(fmt.Sprintf("forceUseGraphAPI = %v\n", s.forceUseGraphAPI))
	bf.WriteString("```\n\n")

	return s.SocialBase.getBaseSupportBundleContent(bf)
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

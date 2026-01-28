package connectors

import (
	"bytes"
	"compress/zlib"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	jose "github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"golang.org/x/oauth2"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/ssosettings/validation"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type SocialBase struct {
	*oauth2.Config
	info          *social.OAuthInfo
	cfg           *setting.Cfg
	reloadMutex   sync.RWMutex
	log           log.Logger
	features      featuremgmt.FeatureToggles
	orgRoleMapper *OrgRoleMapper
	orgMappingCfg MappingConfiguration
	cache         remotecache.CacheStorage
	providerName  string
}

func newSocialBase(name string,
	orgRoleMapper *OrgRoleMapper,
	info *social.OAuthInfo,
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
) *SocialBase {
	return newSocialBaseWithCache(name, orgRoleMapper, info, features, cfg, nil)
}

func newSocialBaseWithCache(name string,
	orgRoleMapper *OrgRoleMapper,
	info *social.OAuthInfo,
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
	cache remotecache.CacheStorage,
) *SocialBase {
	logger := log.New("oauth." + name)

	return &SocialBase{
		Config:        createOAuthConfig(info, cfg, name),
		info:          info,
		log:           logger,
		features:      features,
		cfg:           cfg,
		orgRoleMapper: orgRoleMapper,
		orgMappingCfg: orgRoleMapper.ParseOrgMappingSettings(context.Background(), info.OrgMapping, info.RoleAttributeStrict),
		providerName:  name,
		cache:         cache,
	}
}

func (s *SocialBase) updateInfo(ctx context.Context, name string, info *social.OAuthInfo) {
	s.Config = createOAuthConfig(info, s.cfg, name)
	s.info = info
	s.orgMappingCfg = s.orgRoleMapper.ParseOrgMappingSettings(ctx, info.OrgMapping, info.RoleAttributeStrict)
}

type groupStruct struct {
	Groups []string `json:"groups"`
}

func (s *SocialBase) SupportBundleContent(bf *bytes.Buffer) error {
	s.reloadMutex.RLock()
	defer s.reloadMutex.RUnlock()

	return s.getBaseSupportBundleContent(bf)
}

func (s *SocialBase) GetOAuthInfo() *social.OAuthInfo {
	s.reloadMutex.RLock()
	defer s.reloadMutex.RUnlock()

	return s.info
}

func (s *SocialBase) AuthCodeURL(state string, opts ...oauth2.AuthCodeOption) string {
	s.reloadMutex.RLock()
	defer s.reloadMutex.RUnlock()

	return s.getAuthCodeURL(state, opts...)
}

func (s *SocialBase) getAuthCodeURL(state string, opts ...oauth2.AuthCodeOption) string {
	if s.info.LoginPrompt != "" {
		promptOpt := oauth2.SetAuthURLParam("prompt", s.info.LoginPrompt)

		// Prepend the prompt option to the opts slice to ensure it is applied last.
		// This is necessary in case the caller provides an option that overrides the prompt,
		// such as `oauth2.ApprovalForce`.
		opts = append([]oauth2.AuthCodeOption{promptOpt}, opts...)
	}

	return s.Config.AuthCodeURL(state, opts...)
}

func (s *SocialBase) Exchange(ctx context.Context, code string, opts ...oauth2.AuthCodeOption) (*oauth2.Token, error) {
	s.reloadMutex.RLock()
	defer s.reloadMutex.RUnlock()

	return s.Config.Exchange(ctx, code, opts...)
}

func (s *SocialBase) Client(ctx context.Context, t *oauth2.Token) *http.Client {
	s.reloadMutex.RLock()
	defer s.reloadMutex.RUnlock()

	return s.Config.Client(ctx, t)
}

func (s *SocialBase) TokenSource(ctx context.Context, t *oauth2.Token) oauth2.TokenSource {
	s.reloadMutex.RLock()
	defer s.reloadMutex.RUnlock()

	return s.Config.TokenSource(ctx, t)
}

func (s *SocialBase) getBaseSupportBundleContent(bf *bytes.Buffer) error {
	bf.WriteString("## Client configuration\n\n")
	bf.WriteString("```ini\n")
	fmt.Fprintf(bf, "allow_assign_grafana_admin = %v\n", s.info.AllowAssignGrafanaAdmin)
	fmt.Fprintf(bf, "allow_sign_up = %v\n", s.info.AllowSignup)
	fmt.Fprintf(bf, "allowed_domains = %v\n", s.info.AllowedDomains)
	fmt.Fprintf(bf, "auto_assign_org_role = %v\n", s.cfg.AutoAssignOrgRole)
	fmt.Fprintf(bf, "role_attribute_path = %v\n", s.info.RoleAttributePath)
	fmt.Fprintf(bf, "role_attribute_strict = %v\n", s.info.RoleAttributeStrict)
	fmt.Fprintf(bf, "skip_org_role_sync = %v\n", s.info.SkipOrgRoleSync)
	fmt.Fprintf(bf, "client_authentication = %v\n", s.info.ClientAuthentication)
	fmt.Fprintf(bf, "client_id = %v\n", s.ClientID)
	fmt.Fprintf(bf, "client_secret = %v ; issue if empty\n", strings.Repeat("*", len(s.ClientSecret)))
	fmt.Fprintf(bf, "managed_identity_client_id = %v\n", s.info.ManagedIdentityClientID)
	fmt.Fprintf(bf, "federated_credential_audience = %v\n", s.info.FederatedCredentialAudience)
	fmt.Fprintf(bf, "workload_identity_token_file = %v\n", s.info.WorkloadIdentityTokenFile)
	fmt.Fprintf(bf, "auth_url = %v\n", s.Endpoint.AuthURL)
	fmt.Fprintf(bf, "token_url = %v\n", s.Endpoint.TokenURL)
	fmt.Fprintf(bf, "auth_style = %v\n", s.Endpoint.AuthStyle)
	fmt.Fprintf(bf, "redirect_url = %v\n", s.RedirectURL)
	fmt.Fprintf(bf, "scopes = %v\n", s.Scopes)
	bf.WriteString("```\n\n")

	return nil
}

func (s *SocialBase) extractRoleAndAdminOptional(rawJSON []byte, groups []string) (org.RoleType, bool, error) {
	if s.info.RoleAttributePath == "" {
		if s.info.RoleAttributeStrict {
			return "", false, errRoleAttributePathNotSet.Errorf("role_attribute_path not set and role_attribute_strict is set")
		}
		return "", false, nil
	}

	if role, gAdmin := s.searchRole(rawJSON, groups); role.IsValid() {
		return role, gAdmin, nil
	} else if role != "" {
		return "", false, errInvalidRole.Errorf("invalid role: %s", role)
	}

	if s.info.RoleAttributeStrict {
		return "", false, errRoleAttributeStrictViolation.Errorf("idP did not return a role attribute, but role_attribute_strict is set")
	}

	return "", false, nil
}

func (s *SocialBase) searchRole(rawJSON []byte, groups []string) (org.RoleType, bool) {
	role, err := util.SearchJSONForStringAttr(s.info.RoleAttributePath, rawJSON)
	if err == nil && role != "" {
		return getRoleFromSearch(role)
	}

	if groupBytes, err := json.Marshal(groupStruct{groups}); err == nil {
		role, err := util.SearchJSONForStringAttr(s.info.RoleAttributePath, groupBytes)
		if err == nil && role != "" {
			return getRoleFromSearch(role)
		}
	}

	return "", false
}

func (s *SocialBase) extractOrgs(rawJSON []byte) ([]string, error) {
	if s.info.OrgAttributePath == "" {
		return []string{}, nil
	}

	return util.SearchJSONForStringSliceAttr(s.info.OrgAttributePath, rawJSON)
}

func (s *SocialBase) isGroupMember(groups []string) bool {
	if len(s.info.AllowedGroups) == 0 {
		return true
	}

	for _, allowedGroup := range s.info.AllowedGroups {
		for _, group := range groups {
			if group == allowedGroup {
				return true
			}
		}
	}

	return false
}

func (s *SocialBase) retrieveRawJWTPayload(token any) ([]byte, error) {
	tokenString, ok := token.(string)
	if !ok {
		return nil, fmt.Errorf("token is not a string: %v", token)
	}

	jwtRegexp := regexp.MustCompile("^([-_a-zA-Z0-9=]+)[.]([-_a-zA-Z0-9=]+)[.]([-_a-zA-Z0-9=]+)$")
	matched := jwtRegexp.FindStringSubmatch(tokenString)
	if matched == nil {
		return nil, fmt.Errorf("token is not in JWT format: %s", tokenString)
	}

	rawJSON, err := base64.RawURLEncoding.DecodeString(matched[2])
	if err != nil {
		return nil, fmt.Errorf("error base64 decoding token payload: %w", err)
	}

	headerBytes, err := base64.RawURLEncoding.DecodeString(matched[1])
	if err != nil {
		return nil, fmt.Errorf("error base64 decoding header: %w", err)
	}

	var header map[string]any
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, fmt.Errorf("error deserializing header: %w", err)
	}

	if compressionVal, exists := header["zip"]; exists {
		compression, ok := compressionVal.(string)
		if !ok {
			return nil, fmt.Errorf("unrecognized compression header: %v", compressionVal)
		}

		if compression != "DEF" {
			return nil, fmt.Errorf("unknown compression algorithm: %s", compression)
		}

		fr, err := zlib.NewReader(bytes.NewReader(rawJSON))
		if err != nil {
			return nil, fmt.Errorf("error creating zlib reader: %w", err)
		}
		defer func() {
			if err := fr.Close(); err != nil {
				s.log.Warn("Failed closing zlib reader", "error", err)
			}
		}()

		rawJSON, err = io.ReadAll(fr)
		if err != nil {
			return nil, fmt.Errorf("error decompressing payload: %w", err)
		}
	}

	return rawJSON, nil
}

// getJWKSCacheKeyPrefix returns the cache key prefix for the provider
func (s *SocialBase) getJWKSCacheKeyPrefix() string {
	return s.providerName + "_oauth_jwks-"
}

// getJWKSCacheKey returns the cache key for JWKS
func (s *SocialBase) getJWKSCacheKey() string {
	return s.getJWKSCacheKeyPrefix() + s.ClientID
}

// retrieveJWKSFromCache retrieves JWKS from cache
func (s *SocialBase) retrieveJWKSFromCache(ctx context.Context) (*keySetJWKS, time.Duration, error) {
	if s.cache == nil {
		return &keySetJWKS{}, 0, nil
	}

	cacheKey := s.getJWKSCacheKey()

	if val, err := s.cache.Get(ctx, cacheKey); err == nil {
		var jwks keySetJWKS
		err := json.Unmarshal(val, &jwks)
		s.log.Debug("Retrieved cached key set", "cacheKey", cacheKey)
		return &jwks, 0, err
	}
	s.log.Debug("Keyset not found in cache")

	return &keySetJWKS{}, 0, nil
}

// cacheJWKS caches the JWKS
func (s *SocialBase) cacheJWKS(ctx context.Context, jwks *keySetJWKS, cacheExpiration time.Duration) error {
	if s.cache == nil {
		return nil
	}

	cacheKey := s.getJWKSCacheKey()

	var jsonBuf bytes.Buffer
	if err := json.NewEncoder(&jsonBuf).Encode(jwks); err != nil {
		return err
	}

	if err := s.cache.Set(ctx, cacheKey, jsonBuf.Bytes(), cacheExpiration); err != nil {
		s.log.Warn("Failed to cache key set", "err", err)
	}

	return nil
}

const (
	defaultCacheExpiration = 5 * time.Minute
)

func getCacheExpiration(header string) time.Duration {
	if header == "" {
		return defaultCacheExpiration
	}

	// Cache-Control: public, max-age=14400 (or "max-age = 14400" with spaces)
	cacheControl := strings.Split(header, ",")
	for _, v := range cacheControl {
		if strings.Contains(v, "max-age") {
			parts := strings.Split(v, "=")
			if len(parts) == 2 {
				seconds, err := strconv.Atoi(strings.TrimSpace(parts[1]))
				if err != nil {
					return defaultCacheExpiration
				}
				return time.Duration(seconds) * time.Second
			}
		}
	}

	return defaultCacheExpiration
}

// retrieveJWKSFromURL retrieves JWKS from the configured URL
func (s *SocialBase) retrieveJWKSFromURL(ctx context.Context, client *http.Client, jwkSetURL string) (*keySetJWKS, time.Duration, error) {
	if jwkSetURL == "" {
		return nil, 0, fmt.Errorf("JWK Set URL is not configured")
	}

	resp, err := s.httpGet(ctx, client, jwkSetURL)
	if err != nil {
		return nil, 0, err
	}

	bytesReader := bytes.NewReader(resp.Body)
	var jwks keySetJWKS
	if err := json.NewDecoder(bytesReader).Decode(&jwks); err != nil {
		return nil, 0, err
	}

	cacheExpiration := getCacheExpiration(resp.Headers.Get("cache-control"))
	s.log.Debug("Retrieved key set from URL", "url", jwkSetURL, "cacheExpiration", cacheExpiration)

	return &jwks, cacheExpiration, nil
}

// jwksRetrieverFunc is a function that retrieves a JWKS keyset. Used to unify
// ID token signature validation across OAuth providers (e.g. generic OAuth with
// a static JWKS URL vs Azure AD with discovery URLs derived from the auth URL).
type jwksRetrieverFunc func(ctx context.Context, client *http.Client) (*keySetJWKS, time.Duration, error)

// validateIDTokenSignatureWithRetrievers validates the JWT signature using the
// given JWKS retrievers. It parses the token, then tries each retriever in order
// until a key verifies the signature. Used by both generic OAuth and Azure AD.
func (s *SocialBase) validateIDTokenSignatureWithRetrievers(ctx context.Context, client *http.Client, idTokenString string, retrievers []jwksRetrieverFunc) ([]byte, error) {
	parsedToken, err := jwt.ParseSigned(idTokenString, []jose.SignatureAlgorithm{
		jose.EdDSA, jose.HS256, jose.HS384, jose.HS512,
		jose.RS256, jose.RS384, jose.RS512,
		jose.ES256, jose.ES384, jose.ES512,
		jose.PS256, jose.PS384, jose.PS512,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to parse JWT token: %w", err)
	}

	if len(parsedToken.Headers) == 0 {
		return nil, fmt.Errorf("JWT token has no headers")
	}

	keyID := parsedToken.Headers[0].KeyID

	// first look for the key in the cache, then try the provided retrievers
	retrievers = append([]jwksRetrieverFunc{
		func(ctx context.Context, client *http.Client) (*keySetJWKS, time.Duration, error) {
			return s.retrieveJWKSFromCache(ctx)
		},
	}, retrievers...)

	for _, jwksFunc := range retrievers {
		keyset, expiry, err := jwksFunc(ctx, client)
		if err != nil {
			s.log.Warn("Error retrieving JWKS", "error", err)
			continue
		}

		keys := keyset.Key(keyID)
		for _, key := range keys {
			s.log.Debug("Trying to verify token with key", "kid", key.KeyID)
			var claims map[string]any
			if err := parsedToken.Claims(key, &claims); err == nil {
				// Successfully verified, cache the keyset if we got it from URL
				if expiry != 0 {
					s.log.Debug("Caching key set", "kid", key.KeyID, "expiry", expiry)
					if err := s.cacheJWKS(ctx, keyset, expiry); err != nil {
						s.log.Warn("Failed to cache key set", "err", err)
					}
				}

				// Extract the raw JSON payload from the verified claims
				rawJSON, err := json.Marshal(claims)
				if err != nil {
					return nil, fmt.Errorf("failed to marshal verified claims: %w", err)
				}

				return rawJSON, nil
			}
			s.log.Debug("Failed to verify token with key", "kid", key.KeyID, "err", err)
		}
	}

	return nil, fmt.Errorf("signing key not found for kid: %s", keyID)
}

// validateIDTokenSignature validates the JWT signature using JWKS from cache and the given URL.
func (s *SocialBase) validateIDTokenSignature(ctx context.Context, client *http.Client, idTokenString string, jwkSetURL string) ([]byte, error) {
	retrievers := []jwksRetrieverFunc{
		func(ctx context.Context, client *http.Client) (*keySetJWKS, time.Duration, error) {
			return s.retrieveJWKSFromURL(ctx, client, jwkSetURL)
		},
	}
	return s.validateIDTokenSignatureWithRetrievers(ctx, client, idTokenString, retrievers)
}

// match grafana admin role and translate to org role and bool.
// treat the JSON search result to ensure correct casing.
func getRoleFromSearch(role string) (org.RoleType, bool) {
	if strings.EqualFold(role, social.RoleGrafanaAdmin) {
		return org.RoleAdmin, true
	}

	return org.RoleType(cases.Title(language.Und).String(role)), false
}

func validateInfo(info *social.OAuthInfo, oldInfo *social.OAuthInfo, requester identity.Requester) error {
	return validation.Validate(info, requester,
		validation.RequiredValidator(info.ClientId, "Client Id"),
		validation.AllowAssignGrafanaAdminValidator(info, oldInfo, requester),
		validation.SkipOrgRoleSyncAllowAssignGrafanaAdminValidator,
		validation.OrgAttributePathValidator(info, oldInfo, requester),
		validation.OrgMappingValidator(info, oldInfo, requester),
		validation.LoginPromptValidator,
	)
}

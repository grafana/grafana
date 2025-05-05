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
	"strings"
	"sync"

	"golang.org/x/oauth2"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
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
}

func newSocialBase(name string,
	orgRoleMapper *OrgRoleMapper,
	info *social.OAuthInfo,
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
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

func (s *SocialBase) retrieveRawIDToken(idToken any) ([]byte, error) {
	tokenString, ok := idToken.(string)
	if !ok {
		return nil, fmt.Errorf("id_token is not a string: %v", idToken)
	}

	jwtRegexp := regexp.MustCompile("^([-_a-zA-Z0-9=]+)[.]([-_a-zA-Z0-9=]+)[.]([-_a-zA-Z0-9=]+)$")
	matched := jwtRegexp.FindStringSubmatch(tokenString)
	if matched == nil {
		return nil, fmt.Errorf("id_token is not in JWT format: %s", tokenString)
	}

	rawJSON, err := base64.RawURLEncoding.DecodeString(matched[2])
	if err != nil {
		return nil, fmt.Errorf("error base64 decoding id_token: %w", err)
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
		validation.OrgMappingValidator(info, oldInfo, requester))
}

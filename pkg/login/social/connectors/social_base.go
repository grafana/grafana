package connectors

import (
	"bytes"
	"compress/zlib"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strings"

	"golang.org/x/oauth2"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
)

type SocialBase struct {
	*oauth2.Config
	info                    *social.OAuthInfo
	log                     log.Logger
	allowSignup             bool
	allowAssignGrafanaAdmin bool
	allowedDomains          []string
	allowedGroups           []string

	roleAttributePath   string
	roleAttributeStrict bool
	autoAssignOrgRole   string
	skipOrgRoleSync     bool
	features            featuremgmt.FeatureManager
	useRefreshToken     bool
}

func newSocialBase(name string,
	config *oauth2.Config,
	info *social.OAuthInfo,
	autoAssignOrgRole string,
	skipOrgRoleSync bool,
	features featuremgmt.FeatureManager,
) *SocialBase {
	logger := log.New("oauth." + name)

	return &SocialBase{
		Config:                  config,
		info:                    info,
		log:                     logger,
		allowSignup:             info.AllowSignup,
		allowAssignGrafanaAdmin: info.AllowAssignGrafanaAdmin,
		allowedDomains:          info.AllowedDomains,
		allowedGroups:           info.AllowedGroups,
		roleAttributePath:       info.RoleAttributePath,
		roleAttributeStrict:     info.RoleAttributeStrict,
		autoAssignOrgRole:       autoAssignOrgRole,
		skipOrgRoleSync:         skipOrgRoleSync,
		features:                features,
		useRefreshToken:         info.UseRefreshToken,
	}
}

type groupStruct struct {
	Groups []string `json:"groups"`
}

func (s *SocialBase) SupportBundleContent(bf *bytes.Buffer) error {
	bf.WriteString("## Client configuration\n\n")
	bf.WriteString("```ini\n")
	bf.WriteString(fmt.Sprintf("allow_assign_grafana_admin = %v\n", s.allowAssignGrafanaAdmin))
	bf.WriteString(fmt.Sprintf("allow_sign_up = %v\n", s.allowSignup))
	bf.WriteString(fmt.Sprintf("allowed_domains = %v\n", s.allowedDomains))
	bf.WriteString(fmt.Sprintf("auto_assign_org_role = %v\n", s.autoAssignOrgRole))
	bf.WriteString(fmt.Sprintf("role_attribute_path = %v\n", s.roleAttributePath))
	bf.WriteString(fmt.Sprintf("role_attribute_strict = %v\n", s.roleAttributeStrict))
	bf.WriteString(fmt.Sprintf("skip_org_role_sync = %v\n", s.skipOrgRoleSync))
	bf.WriteString(fmt.Sprintf("client_id = %v\n", s.Config.ClientID))
	bf.WriteString(fmt.Sprintf("client_secret = %v ; issue if empty\n", strings.Repeat("*", len(s.Config.ClientSecret))))
	bf.WriteString(fmt.Sprintf("auth_url = %v\n", s.Config.Endpoint.AuthURL))
	bf.WriteString(fmt.Sprintf("token_url = %v\n", s.Config.Endpoint.TokenURL))
	bf.WriteString(fmt.Sprintf("auth_style = %v\n", s.Config.Endpoint.AuthStyle))
	bf.WriteString(fmt.Sprintf("redirect_url = %v\n", s.Config.RedirectURL))
	bf.WriteString(fmt.Sprintf("scopes = %v\n", s.Config.Scopes))
	bf.WriteString("```\n\n")
	return nil
}

func (s *SocialBase) extractRoleAndAdminOptional(rawJSON []byte, groups []string) (org.RoleType, bool, error) {
	if s.roleAttributePath == "" {
		if s.roleAttributeStrict {
			return "", false, errRoleAttributePathNotSet.Errorf("role_attribute_path not set and role_attribute_strict is set")
		}
		return "", false, nil
	}

	if role, gAdmin := s.searchRole(rawJSON, groups); role.IsValid() {
		return role, gAdmin, nil
	} else if role != "" {
		return "", false, errInvalidRole.Errorf("invalid role: %s", role)
	}

	if s.roleAttributeStrict {
		return "", false, errRoleAttributeStrictViolation.Errorf("idP did not return a role attribute, but role_attribute_strict is set")
	}

	return "", false, nil
}

func (s *SocialBase) extractRoleAndAdmin(rawJSON []byte, groups []string) (org.RoleType, bool, error) {
	role, gAdmin, err := s.extractRoleAndAdminOptional(rawJSON, groups)
	if role == "" {
		role = s.defaultRole()
	}

	return role, gAdmin, err
}

func (s *SocialBase) searchRole(rawJSON []byte, groups []string) (org.RoleType, bool) {
	role, err := s.searchJSONForStringAttr(s.roleAttributePath, rawJSON)
	if err == nil && role != "" {
		return getRoleFromSearch(role)
	}

	if groupBytes, err := json.Marshal(groupStruct{groups}); err == nil {
		role, err := s.searchJSONForStringAttr(s.roleAttributePath, groupBytes)
		if err == nil && role != "" {
			return getRoleFromSearch(role)
		}
	}

	return "", false
}

// defaultRole returns the default role for the user based on the autoAssignOrgRole setting
// if legacy is enabled "" is returned indicating the previous role assignment is used.
func (s *SocialBase) defaultRole() org.RoleType {
	if s.autoAssignOrgRole != "" {
		s.log.Debug("No role found, returning default.")
		return org.RoleType(s.autoAssignOrgRole)
	}

	// should never happen
	return org.RoleViewer
}

func (s *SocialBase) isGroupMember(groups []string) bool {
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

package connectors

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	ssoModels "github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/validation"
	"github.com/grafana/grafana/pkg/util"
)

var ExtraGrafanaComSettingKeys = map[string]ExtraKeyInfo{
	allowedOrganizationsKey: {Type: String, DefaultValue: ""},
}

var (
	_ social.SocialConnector = (*SocialGrafanaCom)(nil)
	_ ssosettings.Reloadable = (*SocialGrafanaCom)(nil)
)

type SocialGrafanaCom struct {
	*SocialBase
	url                  string
	allowedOrganizations []string
}

type OrgRecord struct {
	Login string `json:"login"`
}

func NewGrafanaComProvider(ctx context.Context, info *social.OAuthInfo, cfgProvider configprovider.ConfigProvider, orgRoleMapper *OrgRoleMapper, ssoSettings ssosettings.Service, features featuremgmt.FeatureToggles) (*SocialGrafanaCom, error) {
	cfg, err := cfgProvider.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("get configuration for OAuth provider %q: %w", social.GrafanaComProviderName, err)
	}

	// Override necessary settings
	info.AuthUrl = cfg.GrafanaComURL + "/oauth2/authorize"
	info.TokenUrl = cfg.GrafanaComURL + "/api/oauth2/token"
	info.AuthStyle = "inheader"

	s, err := newSocialBase(social.GrafanaComProviderName, ctx, orgRoleMapper, info, features, cfgProvider)
	if err != nil {
		return nil, err
	}

	allowedOrganizations, err := util.SplitStringWithError(info.Extra[allowedOrganizationsKey])
	if err != nil {
		s.log.Error("Invalid auth configuration setting", "config", allowedOrganizationsKey, "provider", social.GrafanaComProviderName, "error", err)
	}

	provider := &SocialGrafanaCom{
		SocialBase:           s,
		url:                  cfg.GrafanaComURL,
		allowedOrganizations: allowedOrganizations,
	}

	if ssoSettings != nil {
		ssoSettings.RegisterReloadable(social.GrafanaComProviderName, provider)
	}

	return provider, nil
}

func (s *SocialGrafanaCom) Validate(ctx context.Context, newSettings ssoModels.SSOSettings, oldSettings ssoModels.SSOSettings, requester identity.Requester) error {
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
		validation.MustBeEmptyValidator(info.AuthUrl, "Auth URL"),
		validation.MustBeEmptyValidator(info.TokenUrl, "Token URL"),
		validation.MustBeEmptyValidator(info.TeamsUrl, "Teams URL"))
}

func (s *SocialGrafanaCom) Reload(ctx context.Context, settings ssoModels.SSOSettings) error {
	newInfo, err := CreateOAuthInfoFromKeyValuesWithLogging(s.log, social.GrafanaComProviderName, settings.Settings)
	if err != nil {
		return ssosettings.ErrInvalidSettings.Errorf("SSO settings map cannot be converted to OAuthInfo: %v", err)
	}

	allowedOrganizations, err := util.SplitStringWithError(newInfo.Extra[allowedOrganizationsKey])
	if err != nil {
		s.log.Error("Invalid auth configuration setting", "config", allowedOrganizationsKey, "provider", social.GrafanaComProviderName, "error", err)
	}
	cfg, err := s.cfgProvider.Get(ctx)
	if err != nil {
		return fmt.Errorf("get configuration for OAuth provider %q: %w", social.GrafanaComProviderName, err)
	}

	// Override necessary settings
	newInfo.AuthUrl = cfg.GrafanaComURL + "/oauth2/authorize"
	newInfo.TokenUrl = cfg.GrafanaComURL + "/api/oauth2/token"
	newInfo.AuthStyle = "inheader"

	s.reloadMutex.Lock()
	defer s.reloadMutex.Unlock()

	if err := s.updateInfo(ctx, social.GrafanaComProviderName, newInfo); err != nil {
		return err
	}

	s.url = cfg.GrafanaComURL
	s.allowedOrganizations = allowedOrganizations

	return nil
}

func (s *SocialGrafanaCom) IsEmailAllowed(email string) bool {
	return true
}

func (s *SocialGrafanaCom) isOrganizationMember(organizations []OrgRecord) bool {
	if len(s.allowedOrganizations) == 0 {
		return true
	}

	for _, allowedOrganization := range s.allowedOrganizations {
		for _, organization := range organizations {
			if organization.Login == allowedOrganization {
				return true
			}
		}
	}

	return false
}

// UserInfo is used for login credentials for the user
func (s *SocialGrafanaCom) UserInfo(ctx context.Context, client *http.Client, _ *oauth2.Token) (*social.BasicUserInfo, error) {
	s.reloadMutex.RLock()
	defer s.reloadMutex.RUnlock()

	var data struct {
		Id    int         `json:"id"`
		Name  string      `json:"name"`
		Login string      `json:"username"`
		Email string      `json:"email"`
		Role  string      `json:"role"`
		Orgs  []OrgRecord `json:"orgs"`
	}

	response, err := s.httpGet(ctx, client, s.url+"/api/oauth2/user")
	if err != nil {
		return nil, fmt.Errorf("Error getting user info: %s", err)
	}

	err = json.Unmarshal(response.Body, &data)
	if err != nil {
		return nil, fmt.Errorf("Error getting user info: %s", err)
	}

	userInfo := &social.BasicUserInfo{
		Id:    fmt.Sprintf("%d", data.Id),
		Name:  data.Name,
		Login: data.Login,
		Email: data.Email,
	}

	if !s.info.SkipOrgRoleSync {
		userInfo.OrgRoles, err = s.orgRoleMapper.MapOrgRolesContext(ctx, NewMappingConfiguration(map[string]map[int64]org.RoleType{}, false), nil, identity.RoleType(data.Role))
		if err != nil {
			return nil, fmt.Errorf("map organization roles: %w", err)
		}
	}

	if !s.isOrganizationMember(data.Orgs) {
		return nil, ErrMissingOrganizationMembership.Errorf(
			"User is not a member of any of the allowed organizations: %v. Returned Organizations: %v",
			s.allowedOrganizations, data.Orgs)
	}

	return userInfo, nil
}

package connectors

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"golang.org/x/oauth2"

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

var ExtraGrafanaComSettingKeys = map[string]ExtraKeyInfo{
	allowedOrganizationsKey: {Type: String, DefaultValue: ""},
}

var _ social.SocialConnector = (*SocialGrafanaCom)(nil)
var _ ssosettings.Reloadable = (*SocialGrafanaCom)(nil)

type SocialGrafanaCom struct {
	*SocialBase
	url                  string
	allowedOrganizations []string
}

type OrgRecord struct {
	Login string `json:"login"`
}

func NewGrafanaComProvider(info *social.OAuthInfo, cfg *setting.Cfg, ssoSettings ssosettings.Service, features featuremgmt.FeatureToggles) *SocialGrafanaCom {
	// Override necessary settings
	info.AuthUrl = cfg.GrafanaComURL + "/oauth2/authorize"
	info.TokenUrl = cfg.GrafanaComURL + "/api/oauth2/token"
	info.AuthStyle = "inheader"

	provider := &SocialGrafanaCom{
		SocialBase:           newSocialBase(social.GrafanaComProviderName, info, features, cfg),
		url:                  cfg.GrafanaComURL,
		allowedOrganizations: util.SplitString(info.Extra[allowedOrganizationsKey]),
	}

	if features.IsEnabledGlobally(featuremgmt.FlagSsoSettingsApi) {
		ssoSettings.RegisterReloadable(social.GrafanaComProviderName, provider)
	}

	return provider
}

func (s *SocialGrafanaCom) Validate(ctx context.Context, settings ssoModels.SSOSettings, requester identity.Requester) error {
	info, err := CreateOAuthInfoFromKeyValues(settings.Settings)
	if err != nil {
		return ssosettings.ErrInvalidSettings.Errorf("SSO settings map cannot be converted to OAuthInfo: %v", err)
	}

	err = validateInfo(info, requester)
	if err != nil {
		return err
	}

	return validation.Validate(info, requester,
		validation.MustBeEmptyValidator(info.AuthUrl, "Auth URL"),
		validation.MustBeEmptyValidator(info.TokenUrl, "Token URL"),
		validation.MustBeEmptyValidator(info.TeamsUrl, "Teams URL"))
}

func (s *SocialGrafanaCom) Reload(ctx context.Context, settings ssoModels.SSOSettings) error {
	newInfo, err := CreateOAuthInfoFromKeyValues(settings.Settings)
	if err != nil {
		return ssosettings.ErrInvalidSettings.Errorf("SSO settings map cannot be converted to OAuthInfo: %v", err)
	}

	// Override necessary settings
	newInfo.AuthUrl = s.cfg.GrafanaComURL + "/oauth2/authorize"
	newInfo.TokenUrl = s.cfg.GrafanaComURL + "/api/oauth2/token"
	newInfo.AuthStyle = "inheader"

	s.reloadMutex.Lock()
	defer s.reloadMutex.Unlock()

	s.updateInfo(social.GrafanaComProviderName, newInfo)

	s.url = s.cfg.GrafanaComURL
	s.allowedOrganizations = util.SplitString(newInfo.Extra[allowedOrganizationsKey])

	return nil
}

func (s *SocialGrafanaCom) IsEmailAllowed(email string) bool {
	return true
}

func (s *SocialGrafanaCom) IsOrganizationMember(organizations []OrgRecord) bool {
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
	var data struct {
		Id    int         `json:"id"`
		Name  string      `json:"name"`
		Login string      `json:"username"`
		Email string      `json:"email"`
		Role  string      `json:"role"`
		Orgs  []OrgRecord `json:"orgs"`
	}

	info := s.GetOAuthInfo()

	response, err := s.httpGet(ctx, client, s.url+"/api/oauth2/user")

	if err != nil {
		return nil, fmt.Errorf("Error getting user info: %s", err)
	}

	err = json.Unmarshal(response.Body, &data)
	if err != nil {
		return nil, fmt.Errorf("Error getting user info: %s", err)
	}

	// on login we do not want to display the role from the external provider
	var role roletype.RoleType
	if !info.SkipOrgRoleSync {
		role = org.RoleType(data.Role)
	}
	userInfo := &social.BasicUserInfo{
		Id:    fmt.Sprintf("%d", data.Id),
		Name:  data.Name,
		Login: data.Login,
		Email: data.Email,
		Role:  role,
	}

	if !s.IsOrganizationMember(data.Orgs) {
		return nil, ErrMissingOrganizationMembership.Errorf(
			"User is not a member of any of the allowed organizations: %v. Returned Organizations: %v",
			s.allowedOrganizations, data.Orgs)
	}

	return userInfo, nil
}

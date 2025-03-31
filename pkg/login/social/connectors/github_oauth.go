package connectors

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	ssoModels "github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/validation"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var ExtraGithubSettingKeys = map[string]ExtraKeyInfo{
	allowedOrganizationsKey: {Type: String},
	teamIdsKey:              {Type: String},
}

var _ social.SocialConnector = (*SocialGithub)(nil)
var _ ssosettings.Reloadable = (*SocialGithub)(nil)

type SocialGithub struct {
	*SocialBase
	allowedOrganizations []string
	teamIds              []int
}

type GithubTeam struct {
	Id           int    `json:"id"`
	Slug         string `json:"slug"`
	URL          string `json:"html_url"`
	Organization struct {
		Login string `json:"login"`
	} `json:"organization"`
	Parent *struct {
		Id int `json:"id"`
	} `json:"parent"`
}

var (
	ErrMissingTeamMembership = errutil.Unauthorized(
		"auth.missing_team",
		errutil.WithPublicMessage(
			"User is not a member of one of the required teams. Please contact identity provider administrator."))
	ErrMissingOrganizationMembership = errutil.Unauthorized(
		"auth.missing_organization",
		errutil.WithPublicMessage(
			"User is not a member of one of the required organizations. Please contact identity provider administrator."))
)

func NewGitHubProvider(info *social.OAuthInfo, cfg *setting.Cfg, orgRoleMapper *OrgRoleMapper, ssoSettings ssosettings.Service, features featuremgmt.FeatureToggles) *SocialGithub {
	s := newSocialBase(social.GitHubProviderName, orgRoleMapper, info, features, cfg)

	teamIdsSplitted, err := util.SplitStringWithError(info.Extra[teamIdsKey])
	if err != nil {
		s.log.Error("Invalid auth configuration setting", "config", teamIdsKey, "provider", social.GitHubProviderName, "error", err)
	}
	teamIds := mustInts(teamIdsSplitted)

	allowedOrganizations, err := util.SplitStringWithError(info.Extra[allowedOrganizationsKey])
	if err != nil {
		s.log.Error("Invalid auth configuration setting", "config", allowedOrganizationsKey, "provider", social.GitHubProviderName, "error", err)
	}

	provider := &SocialGithub{
		SocialBase:           s,
		teamIds:              teamIds,
		allowedOrganizations: allowedOrganizations,
	}

	if len(teamIdsSplitted) != len(teamIds) {
		provider.log.Warn("Failed to parse team ids. Team ids must be a list of numbers.", "teamIds", teamIdsSplitted)
	}

	if features.IsEnabledGlobally(featuremgmt.FlagSsoSettingsApi) {
		ssoSettings.RegisterReloadable(social.GitHubProviderName, provider)
	}

	return provider
}

func (s *SocialGithub) Validate(ctx context.Context, newSettings ssoModels.SSOSettings, oldSettings ssoModels.SSOSettings, requester identity.Requester) error {
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
		validation.MustBeEmptyValidator(info.ApiUrl, "API URL"),
		teamIdsNumbersValidator)
}

func teamIdsNumbersValidator(info *social.OAuthInfo, requester identity.Requester) error {
	teamIdsSplitted := util.SplitString(info.Extra[teamIdsKey])
	teamIds := mustInts(teamIdsSplitted)

	if len(teamIdsSplitted) != len(teamIds) {
		return ssosettings.ErrInvalidOAuthConfig("Failed to parse Team Ids. Team Ids must be a list of numbers.")
	}

	return nil
}

func (s *SocialGithub) Reload(ctx context.Context, settings ssoModels.SSOSettings) error {
	newInfo, err := CreateOAuthInfoFromKeyValuesWithLogging(s.log, social.GitHubProviderName, settings.Settings)
	if err != nil {
		return ssosettings.ErrInvalidSettings.Errorf("SSO settings map cannot be converted to OAuthInfo: %v", err)
	}

	teamIdsSplitted, err := util.SplitStringWithError(newInfo.Extra[teamIdsKey])
	if err != nil {
		s.log.Error("Invalid auth configuration setting", "config", teamIdsKey, "provider", social.GitHubProviderName, "error", err)
	}
	teamIds := mustInts(teamIdsSplitted)

	allowedOrganizations, err := util.SplitStringWithError(newInfo.Extra[allowedOrganizationsKey])
	if err != nil {
		s.log.Error("Invalid auth configuration setting", "config", allowedOrganizationsKey, "provider", social.GitHubProviderName, "error", err)
	}

	if len(teamIdsSplitted) != len(teamIds) {
		s.log.Warn("Failed to parse team ids. Team ids must be a list of numbers.", "teamIds", teamIdsSplitted)
	}

	s.reloadMutex.Lock()
	defer s.reloadMutex.Unlock()

	s.updateInfo(ctx, social.GitHubProviderName, newInfo)

	s.teamIds = teamIds
	s.allowedOrganizations = allowedOrganizations

	return nil
}

func (s *SocialGithub) isTeamMember(ctx context.Context, client *http.Client) bool {
	if len(s.teamIds) == 0 {
		return true
	}

	teamMemberships, err := s.fetchTeamMemberships(ctx, client)
	if err != nil {
		return false
	}

	for _, teamId := range s.teamIds {
		for _, membership := range teamMemberships {
			if teamId == membership.Id || (membership.Parent != nil && teamId == membership.Parent.Id) {
				return true
			}
		}
	}

	return false
}

func (s *SocialGithub) isOrganizationMember(ctx context.Context,
	client *http.Client, organizationsUrl string) bool {
	if len(s.allowedOrganizations) == 0 {
		return true
	}

	organizations, err := s.fetchOrganizations(ctx, client, organizationsUrl)
	if err != nil {
		return false
	}

	for _, allowedOrganization := range s.allowedOrganizations {
		for _, organization := range organizations {
			if strings.EqualFold(organization, allowedOrganization) {
				return true
			}
		}
	}

	return false
}

func (s *SocialGithub) fetchPrivateEmail(ctx context.Context, client *http.Client) (string, error) {
	type Record struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}

	response, err := s.httpGet(ctx, client, s.info.ApiUrl+"/emails")
	if err != nil {
		return "", fmt.Errorf("Error getting email address: %s", err)
	}

	var records []Record

	err = json.Unmarshal(response.Body, &records)
	if err != nil {
		return "", fmt.Errorf("Error getting email address: %s", err)
	}

	var email = ""
	for _, record := range records {
		if record.Primary {
			email = record.Email
		}
	}

	return email, nil
}

func (s *SocialGithub) fetchTeamMemberships(ctx context.Context, client *http.Client) ([]GithubTeam, error) {
	url := s.info.ApiUrl + "/teams?per_page=100"
	hasMore := true
	teams := make([]GithubTeam, 0)

	for hasMore {
		response, err := s.httpGet(ctx, client, url)
		if err != nil {
			return nil, fmt.Errorf("Error getting team memberships: %s", err)
		}

		var records []GithubTeam

		err = json.Unmarshal(response.Body, &records)
		if err != nil {
			return nil, fmt.Errorf("Error getting team memberships: %s", err)
		}

		teams = append(teams, records...)

		url, hasMore = s.hasMoreRecords(response.Headers)
	}

	return teams, nil
}

func (s *SocialGithub) hasMoreRecords(headers http.Header) (string, bool) {
	value, exists := headers["Link"]
	if !exists {
		return "", false
	}

	pattern := regexp.MustCompile(`<([^>]+)>; rel="next"`)
	matches := pattern.FindStringSubmatch(value[0])

	if matches == nil {
		return "", false
	}

	url := matches[1]

	return url, true
}

func (s *SocialGithub) fetchOrganizations(ctx context.Context, client *http.Client, organizationsUrl string) ([]string, error) {
	url := organizationsUrl
	hasMore := true
	logins := make([]string, 0)

	type Record struct {
		Login string `json:"login"`
	}

	for hasMore {
		response, err := s.httpGet(ctx, client, url)
		if err != nil {
			return nil, fmt.Errorf("error getting organizations: %s", err)
		}

		var records []Record

		err = json.Unmarshal(response.Body, &records)
		if err != nil {
			return nil, fmt.Errorf("error getting organizations: %s", err)
		}

		for _, record := range records {
			logins = append(logins, record.Login)
		}

		url, hasMore = s.hasMoreRecords(response.Headers)
	}
	return logins, nil
}

func (s *SocialGithub) UserInfo(ctx context.Context, client *http.Client, token *oauth2.Token) (*social.BasicUserInfo, error) {
	s.reloadMutex.RLock()
	defer s.reloadMutex.RUnlock()

	var data struct {
		Id    int    `json:"id"`
		Login string `json:"login"`
		Email string `json:"email"`
		Name  string `json:"name"`
	}

	response, err := s.httpGet(ctx, client, s.info.ApiUrl)
	if err != nil {
		return nil, fmt.Errorf("error getting user info: %s", err)
	}

	if err = json.Unmarshal(response.Body, &data); err != nil {
		return nil, fmt.Errorf("error unmarshalling user info: %s", err)
	}

	teamMemberships, err := s.fetchTeamMemberships(ctx, client)
	if err != nil {
		return nil, fmt.Errorf("error getting user teams: %s", err)
	}

	userInfo := &social.BasicUserInfo{
		Name:   data.Login,
		Login:  data.Login,
		Id:     fmt.Sprintf("%d", data.Id),
		Email:  data.Email,
		Groups: convertToGroupList(teamMemberships),
	}

	if s.info.AllowAssignGrafanaAdmin && s.info.SkipOrgRoleSync {
		s.log.Debug("AllowAssignGrafanaAdmin and skipOrgRoleSync are both set, Grafana Admin role will not be synced, consider setting one or the other")
	}

	var directlyMappedRole org.RoleType

	if !s.info.SkipOrgRoleSync {
		var grafanaAdmin bool
		directlyMappedRole, grafanaAdmin, err = s.extractRoleAndAdminOptional(response.Body, userInfo.Groups)
		if err != nil {
			s.log.Warn("Failed to extract role", "err", err)
		}

		if s.info.AllowAssignGrafanaAdmin {
			userInfo.IsGrafanaAdmin = &grafanaAdmin
		}

		userInfo.OrgRoles = s.orgRoleMapper.MapOrgRoles(s.orgMappingCfg, userInfo.Groups, directlyMappedRole)
		if s.info.RoleAttributeStrict && len(userInfo.OrgRoles) == 0 {
			return nil, errRoleAttributeStrictViolation.Errorf("could not evaluate any valid roles using IdP provided data")
		}
	}

	if data.Name != "" {
		userInfo.Name = data.Name
	}

	organizationsUrl := s.info.ApiUrl + "/orgs?per_page=100"

	if !s.isTeamMember(ctx, client) {
		return nil, ErrMissingTeamMembership.Errorf("User is not a member of any of the allowed teams: %v", s.teamIds)
	}

	if !s.isOrganizationMember(ctx, client, organizationsUrl) {
		return nil, ErrMissingOrganizationMembership.Errorf(
			"User is not a member of any of the allowed organizations: %v",
			s.allowedOrganizations)
	}

	if userInfo.Email == "" {
		userInfo.Email, err = s.fetchPrivateEmail(ctx, client)
		if err != nil {
			return nil, err
		}
	}

	return userInfo, nil
}

func (t *GithubTeam) GetShorthand() (string, error) {
	if t.Organization.Login == "" || t.Slug == "" {
		return "", errors.New("Error getting team shorthand")
	}
	return fmt.Sprintf("@%s/%s", t.Organization.Login, t.Slug), nil
}

func convertToGroupList(t []GithubTeam) []string {
	groups := make([]string, 0)
	for _, team := range t {
		// Group shouldn't be empty string, otherwise team sync will not work properly
		if team.URL != "" {
			groups = append(groups, team.URL)
		}
		teamShorthand, _ := team.GetShorthand()
		if teamShorthand != "" {
			groups = append(groups, teamShorthand)
		}
	}

	return groups
}

func mustInts(s []string) []int {
	result := make([]int, 0, len(s))
	for _, v := range s {
		num, err := strconv.Atoi(v)
		if err != nil {
			return []int{}
		}
		result = append(result, num)
	}
	return result
}

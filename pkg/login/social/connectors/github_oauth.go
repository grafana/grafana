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

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	ssoModels "github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/validation"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
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

func NewGitHubProvider(info *social.OAuthInfo, cfg *setting.Cfg, ssoSettings ssosettings.Service, features featuremgmt.FeatureToggles) *SocialGithub {
	teamIdsSplitted := util.SplitString(info.Extra[teamIdsKey])
	teamIds := mustInts(teamIdsSplitted)

	provider := &SocialGithub{
		SocialBase:           newSocialBase(social.GitHubProviderName, info, features, cfg),
		teamIds:              teamIds,
		allowedOrganizations: util.SplitString(info.Extra[allowedOrganizationsKey]),
	}

	if len(teamIdsSplitted) != len(teamIds) {
		provider.log.Warn("Failed to parse team ids. Team ids must be a list of numbers.", "teamIds", teamIdsSplitted)
	}

	if features.IsEnabledGlobally(featuremgmt.FlagSsoSettingsApi) {
		ssoSettings.RegisterReloadable(social.GitHubProviderName, provider)
	}

	return provider
}

func (s *SocialGithub) Validate(ctx context.Context, settings ssoModels.SSOSettings, requester identity.Requester) error {
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
	newInfo, err := CreateOAuthInfoFromKeyValues(settings.Settings)
	if err != nil {
		return ssosettings.ErrInvalidSettings.Errorf("SSO settings map cannot be converted to OAuthInfo: %v", err)
	}

	teamIdsSplitted := util.SplitString(newInfo.Extra[teamIdsKey])
	teamIds := mustInts(teamIdsSplitted)

	if len(teamIdsSplitted) != len(teamIds) {
		s.log.Warn("Failed to parse team ids. Team ids must be a list of numbers.", "teamIds", teamIdsSplitted)
	}

	s.reloadMutex.Lock()
	defer s.reloadMutex.Unlock()

	s.updateInfo(social.GitHubProviderName, newInfo)

	s.teamIds = teamIds
	s.allowedOrganizations = util.SplitString(newInfo.Extra[allowedOrganizationsKey])

	return nil
}

func (s *SocialGithub) IsTeamMember(ctx context.Context, client *http.Client) bool {
	if len(s.teamIds) == 0 {
		return true
	}

	teamMemberships, err := s.FetchTeamMemberships(ctx, client)
	if err != nil {
		return false
	}

	for _, teamId := range s.teamIds {
		for _, membership := range teamMemberships {
			if teamId == membership.Id {
				return true
			}
		}
	}

	return false
}

func (s *SocialGithub) IsOrganizationMember(ctx context.Context,
	client *http.Client, organizationsUrl string) bool {
	if len(s.allowedOrganizations) == 0 {
		return true
	}

	organizations, err := s.FetchOrganizations(ctx, client, organizationsUrl)
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

func (s *SocialGithub) FetchPrivateEmail(ctx context.Context, client *http.Client) (string, error) {
	type Record struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}

	info := s.GetOAuthInfo()

	response, err := s.httpGet(ctx, client, fmt.Sprintf(info.ApiUrl+"/emails"))
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

func (s *SocialGithub) FetchTeamMemberships(ctx context.Context, client *http.Client) ([]GithubTeam, error) {
	info := s.GetOAuthInfo()

	url := fmt.Sprintf(info.ApiUrl + "/teams?per_page=100")
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

		url, hasMore = s.HasMoreRecords(response.Headers)
	}

	return teams, nil
}

func (s *SocialGithub) HasMoreRecords(headers http.Header) (string, bool) {
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

func (s *SocialGithub) FetchOrganizations(ctx context.Context, client *http.Client, organizationsUrl string) ([]string, error) {
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

		url, hasMore = s.HasMoreRecords(response.Headers)
	}
	return logins, nil
}

func (s *SocialGithub) UserInfo(ctx context.Context, client *http.Client, token *oauth2.Token) (*social.BasicUserInfo, error) {
	var data struct {
		Id    int    `json:"id"`
		Login string `json:"login"`
		Email string `json:"email"`
		Name  string `json:"name"`
	}

	info := s.GetOAuthInfo()

	response, err := s.httpGet(ctx, client, info.ApiUrl)
	if err != nil {
		return nil, fmt.Errorf("error getting user info: %s", err)
	}

	if err = json.Unmarshal(response.Body, &data); err != nil {
		return nil, fmt.Errorf("error unmarshalling user info: %s", err)
	}

	teamMemberships, err := s.FetchTeamMemberships(ctx, client)
	if err != nil {
		return nil, fmt.Errorf("error getting user teams: %s", err)
	}

	teams := convertToGroupList(teamMemberships)

	var role roletype.RoleType
	var isGrafanaAdmin *bool = nil

	if !info.SkipOrgRoleSync {
		var grafanaAdmin bool
		role, grafanaAdmin, err = s.extractRoleAndAdmin(response.Body, teams)
		if err != nil {
			return nil, err
		}

		if info.AllowAssignGrafanaAdmin {
			isGrafanaAdmin = &grafanaAdmin
		}
	}

	// we skip allowing assignment of GrafanaAdmin if skipOrgRoleSync is present
	if info.AllowAssignGrafanaAdmin && info.SkipOrgRoleSync {
		s.log.Debug("AllowAssignGrafanaAdmin and skipOrgRoleSync are both set, Grafana Admin role will not be synced, consider setting one or the other")
	}

	userInfo := &social.BasicUserInfo{
		Name:           data.Login,
		Login:          data.Login,
		Id:             fmt.Sprintf("%d", data.Id),
		Email:          data.Email,
		Role:           role,
		Groups:         teams,
		IsGrafanaAdmin: isGrafanaAdmin,
	}
	if data.Name != "" {
		userInfo.Name = data.Name
	}

	organizationsUrl := fmt.Sprintf(info.ApiUrl + "/orgs?per_page=100")

	if !s.IsTeamMember(ctx, client) {
		return nil, ErrMissingTeamMembership.Errorf("User is not a member of any of the allowed teams: %v", s.teamIds)
	}

	if !s.IsOrganizationMember(ctx, client, organizationsUrl) {
		return nil, ErrMissingOrganizationMembership.Errorf(
			"User is not a member of any of the allowed organizations: %v",
			s.allowedOrganizations)
	}

	if userInfo.Email == "" {
		userInfo.Email, err = s.FetchPrivateEmail(ctx, client)
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

package connectors

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/mail"
	"strconv"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	ssoModels "github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/validation"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const (
	nameAttributePathKey    = "name_attribute_path"
	loginAttributePathKey   = "login_attribute_path"
	idTokenAttributeNameKey = "id_token_attribute_name" // #nosec G101 not a hardcoded credential
)

var ExtraGenericOAuthSettingKeys = map[string]ExtraKeyInfo{
	nameAttributePathKey:    {Type: String},
	loginAttributePathKey:   {Type: String},
	idTokenAttributeNameKey: {Type: String},
	teamIdsKey:              {Type: String},
	allowedOrganizationsKey: {Type: String},
}

var _ social.SocialConnector = (*SocialGenericOAuth)(nil)
var _ ssosettings.Reloadable = (*SocialGenericOAuth)(nil)

type SocialGenericOAuth struct {
	*SocialBase
	allowedOrganizations []string
	teamsUrl             string
	emailAttributeName   string
	emailAttributePath   string
	loginAttributePath   string
	nameAttributePath    string
	groupsAttributePath  string
	idTokenAttributeName string
	teamIdsAttributePath string
	teamIds              []string
}

func NewGenericOAuthProvider(info *social.OAuthInfo, cfg *setting.Cfg, orgRoleMapper *OrgRoleMapper, ssoSettings ssosettings.Service, features featuremgmt.FeatureToggles) *SocialGenericOAuth {
	s := newSocialBase(social.GenericOAuthProviderName, orgRoleMapper, info, features, cfg)

	teamIds, err := util.SplitStringWithError(info.Extra[teamIdsKey])
	if err != nil {
		s.log.Error("Invalid auth configuration setting", "config", teamIdsKey, "provider", social.GenericOAuthProviderName, "error", err)
	}

	allowedOrganizations, err := util.SplitStringWithError(info.Extra[allowedOrganizationsKey])
	if err != nil {
		s.log.Error("Invalid auth configuration setting", "config", allowedOrganizationsKey, "provider", social.GenericOAuthProviderName, "error", err)
	}

	provider := &SocialGenericOAuth{
		SocialBase:           newSocialBase(social.GenericOAuthProviderName, orgRoleMapper, info, features, cfg),
		teamsUrl:             info.TeamsUrl,
		emailAttributeName:   info.EmailAttributeName,
		emailAttributePath:   info.EmailAttributePath,
		nameAttributePath:    info.Extra[nameAttributePathKey],
		groupsAttributePath:  info.GroupsAttributePath,
		loginAttributePath:   info.Extra[loginAttributePathKey],
		idTokenAttributeName: info.Extra[idTokenAttributeNameKey],
		teamIdsAttributePath: info.TeamIdsAttributePath,
		teamIds:              teamIds,
		allowedOrganizations: allowedOrganizations,
	}

	ssoSettings.RegisterReloadable(social.GenericOAuthProviderName, provider)

	return provider
}

func (s *SocialGenericOAuth) Validate(ctx context.Context, newSettings ssoModels.SSOSettings, oldSettings ssoModels.SSOSettings, requester identity.Requester) error {
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

	err = validation.Validate(info, requester,
		validation.UrlValidator(info.AuthUrl, "Auth URL"),
		validation.UrlValidator(info.TokenUrl, "Token URL"),
		validateTeamsUrlWhenNotEmpty)

	if err != nil {
		return err
	}

	teamIds := util.SplitString(info.Extra[teamIdsKey])
	if len(teamIds) > 0 && (info.TeamIdsAttributePath == "" || info.TeamsUrl == "") {
		return ssosettings.ErrInvalidOAuthConfig("If Team Ids are configured then Team Ids attribute path and Teams URL must be configured.")
	}

	if len(info.AllowedGroups) > 0 && info.GroupsAttributePath == "" {
		return ssosettings.ErrInvalidOAuthConfig("If Allowed groups is configured then Groups attribute path must be configured.")
	}

	return nil
}

func validateTeamsUrlWhenNotEmpty(info *social.OAuthInfo, requester identity.Requester) error {
	if info.TeamsUrl == "" {
		return nil
	}
	return validation.UrlValidator(info.TeamsUrl, "Teams URL")(info, requester)
}

func (s *SocialGenericOAuth) Reload(ctx context.Context, settings ssoModels.SSOSettings) error {
	newInfo, err := CreateOAuthInfoFromKeyValuesWithLogging(s.log, social.GenericOAuthProviderName, settings.Settings)
	if err != nil {
		return ssosettings.ErrInvalidSettings.Errorf("SSO settings map cannot be converted to OAuthInfo: %v", err)
	}

	s.reloadMutex.Lock()
	defer s.reloadMutex.Unlock()

	s.updateInfo(ctx, social.GenericOAuthProviderName, newInfo)

	teamIds, err := util.SplitStringWithError(newInfo.Extra[teamIdsKey])
	if err != nil {
		s.log.Error("Invalid auth configuration setting", "config", teamIdsKey, "provider", social.GenericOAuthProviderName, "error", err)
	}
	allowedOrganizations, err := util.SplitStringWithError(newInfo.Extra[allowedOrganizationsKey])
	if err != nil {
		s.log.Error("Invalid auth configuration setting", "config", allowedOrganizationsKey, "provider", social.GenericOAuthProviderName, "error", err)
	}

	s.teamsUrl = newInfo.TeamsUrl
	s.emailAttributeName = newInfo.EmailAttributeName
	s.emailAttributePath = newInfo.EmailAttributePath
	s.nameAttributePath = newInfo.Extra[nameAttributePathKey]
	s.groupsAttributePath = newInfo.GroupsAttributePath
	s.loginAttributePath = newInfo.Extra[loginAttributePathKey]
	s.idTokenAttributeName = newInfo.Extra[idTokenAttributeNameKey]
	s.teamIdsAttributePath = newInfo.TeamIdsAttributePath
	s.teamIds = teamIds
	s.allowedOrganizations = allowedOrganizations

	return nil
}

// TODOD: remove this in the next PR and use the isGroupMember from social.go
func (s *SocialGenericOAuth) isGroupMember(groups []string) bool {
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

func (s *SocialGenericOAuth) isTeamMember(ctx context.Context, client *http.Client) bool {
	if len(s.teamIds) == 0 {
		return true
	}

	teamMemberships, err := s.fetchTeamMemberships(ctx, client)
	if err != nil {
		return false
	}

	for _, teamId := range s.teamIds {
		for _, membershipId := range teamMemberships {
			if teamId == membershipId {
				return true
			}
		}
	}

	return false
}

func (s *SocialGenericOAuth) isOrganizationMember(ctx context.Context, client *http.Client) bool {
	if len(s.allowedOrganizations) == 0 {
		return true
	}

	organizations, ok := s.fetchOrganizations(ctx, client)
	if !ok {
		return false
	}

	for _, allowedOrganization := range s.allowedOrganizations {
		for _, organization := range organizations {
			if organization == allowedOrganization {
				return true
			}
		}
	}

	return false
}

type UserInfoJson struct {
	Sub         string              `json:"sub"`
	Name        string              `json:"name"`
	DisplayName string              `json:"display_name"`
	Login       string              `json:"login"`
	Username    string              `json:"username"`
	Email       string              `json:"email"`
	Upn         string              `json:"upn"`
	Attributes  map[string][]string `json:"attributes"`
	rawJSON     []byte
	source      string
}

func (info *UserInfoJson) String() string {
	return fmt.Sprintf(
		"Name: %s, Displayname: %s, Login: %s, Username: %s, Email: %s, Upn: %s, Attributes: %v",
		info.Name, info.DisplayName, info.Login, info.Username, info.Email, info.Upn, info.Attributes)
}

func (s *SocialGenericOAuth) UserInfo(ctx context.Context, client *http.Client, token *oauth2.Token) (*social.BasicUserInfo, error) {
	s.reloadMutex.RLock()
	defer s.reloadMutex.RUnlock()

	s.log.Debug("Getting user info")

	// 1. Collect user info data from various sources
	dataSources := s.collectUserInfoData(ctx, client, token)

	// 2. Build user info from collected data
	userInfo, externalOrgs, err := s.buildUserInfo(dataSources)
	if err != nil {
		return nil, err
	}

	// 3. Post-process user info
	err = s.postProcessUserInfo(ctx, client, userInfo, externalOrgs)
	if err != nil {
		return nil, err
	}

	// 4. Validate user access
	err = s.validateUserAccess(ctx, client, userInfo)
	if err != nil {
		return nil, err
	}

	s.log.Debug("User info result", "result", userInfo)
	return userInfo, nil
}

// collectUserInfoData gathers user information from ID token, API, and access token
func (s *SocialGenericOAuth) collectUserInfoData(ctx context.Context, client *http.Client, token *oauth2.Token) []*UserInfoJson {
	dataSources := make([]*UserInfoJson, 0, 3)

	if idTokenData := s.extractFromIDToken(token); idTokenData != nil {
		dataSources = append(dataSources, idTokenData)
	}
	if apiData := s.extractFromAPI(ctx, client); apiData != nil {
		dataSources = append(dataSources, apiData)
	}
	if accessTokenData := s.extractFromAccessToken(token); accessTokenData != nil {
		dataSources = append(dataSources, accessTokenData)
	}

	return dataSources
}

// buildUserInfo constructs BasicUserInfo from collected data sources
func (s *SocialGenericOAuth) buildUserInfo(dataSources []*UserInfoJson) (*social.BasicUserInfo, []string, error) {
	userInfo := &social.BasicUserInfo{}
	var externalOrgs []string

	for _, data := range dataSources {
		s.log.Debug("Processing external user info", "source", data.source, "data", data)

		s.extractBasicUserFields(userInfo, data)

		if err := s.extractRoleAndOrgs(userInfo, &externalOrgs, data); err != nil {
			return nil, nil, err
		}

		s.extractUserGroups(userInfo, data)
	}

	return userInfo, externalOrgs, nil
}

// extractBasicUserFields extracts basic user fields (ID, Name, Login, Email) from data
func (s *SocialGenericOAuth) extractBasicUserFields(userInfo *social.BasicUserInfo, data *UserInfoJson) {
	if userInfo.Id == "" {
		userInfo.Id = data.Sub
	}

	if userInfo.Name == "" {
		userInfo.Name = s.extractUserName(data)
	}

	if userInfo.Login == "" {
		userInfo.Login = s.extractLogin(data)
	}

	if userInfo.Email == "" {
		userInfo.Email = s.extractEmail(data)
		if userInfo.Email != "" {
			s.log.Debug("Set user info email from extracted email", "email", userInfo.Email)
		}
	}
}

// extractRoleAndOrgs extracts role and organization information from data
func (s *SocialGenericOAuth) extractRoleAndOrgs(userInfo *social.BasicUserInfo, externalOrgs *[]string, data *UserInfoJson) error {
	if userInfo.Role == "" && !s.info.SkipOrgRoleSync {
		role, grafanaAdmin, err := s.extractRoleAndAdminOptional(data.rawJSON, []string{})
		if err != nil {
			s.log.Warn("Failed to extract role", "err", err)
		} else {
			userInfo.Role = role
			if s.info.AllowAssignGrafanaAdmin {
				userInfo.IsGrafanaAdmin = &grafanaAdmin
			}
		}
	}

	if len(*externalOrgs) == 0 && !s.info.SkipOrgRoleSync {
		orgs, err := s.extractOrgs(data.rawJSON)
		if err != nil {
			s.log.Warn("Failed to extract orgs", "err", err)
			return err
		}
		*externalOrgs = orgs
	}

	return nil
}

// extractUserGroups extracts group information from data
func (s *SocialGenericOAuth) extractUserGroups(userInfo *social.BasicUserInfo, data *UserInfoJson) {
	if len(userInfo.Groups) == 0 {
		groups, err := s.extractGroups(data)
		if err != nil {
			s.log.Warn("Failed to extract groups", "err", err)
		} else if len(groups) > 0 {
			s.log.Debug("Setting user info groups from extracted groups")
			userInfo.Groups = groups
		}
	}
}

// postProcessUserInfo handles post-processing of user info (org roles, private email, etc.)
func (s *SocialGenericOAuth) postProcessUserInfo(ctx context.Context, client *http.Client, userInfo *social.BasicUserInfo, externalOrgs []string) error {
	if !s.info.SkipOrgRoleSync {
		userInfo.OrgRoles = s.orgRoleMapper.MapOrgRoles(s.orgMappingCfg, externalOrgs, userInfo.Role)
		if s.info.RoleAttributeStrict && len(userInfo.OrgRoles) == 0 {
			return errRoleAttributeStrictViolation.Errorf("could not evaluate any valid roles using IdP provided data")
		}
	}

	if s.info.AllowAssignGrafanaAdmin && s.info.SkipOrgRoleSync {
		s.log.Debug("AllowAssignGrafanaAdmin and skipOrgRoleSync are both set, Grafana Admin role will not be synced, consider setting one or the other")
	}

	if s.canFetchPrivateEmail(userInfo) {
		email, err := s.fetchPrivateEmail(ctx, client)
		if err != nil {
			return err
		}
		userInfo.Email = email
		s.log.Debug("Setting email from fetched private email", "email", userInfo.Email)
	}

	if userInfo.Login == "" {
		s.log.Debug("Defaulting to using email for user info login", "email", userInfo.Email)
		userInfo.Login = userInfo.Email
	}

	return nil
}

// validateUserAccess validates user access based on team, organization, and group membership
func (s *SocialGenericOAuth) validateUserAccess(ctx context.Context, client *http.Client, userInfo *social.BasicUserInfo) error {
	if !s.isTeamMember(ctx, client) {
		return &SocialError{"User not a member of one of the required teams"}
	}

	if !s.isOrganizationMember(ctx, client) {
		return &SocialError{"User not a member of one of the required organizations"}
	}

	if !s.isGroupMember(userInfo.Groups) {
		return errMissingGroupMembership
	}

	return nil
}

func (s *SocialGenericOAuth) canFetchPrivateEmail(userinfo *social.BasicUserInfo) bool {
	return s.info.ApiUrl != "" && userinfo.Email == ""
}

func (s *SocialGenericOAuth) extractFromIDToken(token *oauth2.Token) *UserInfoJson {
	s.log.Debug("Extracting user info from OAuth ID token")

	idTokenAttribute := "id_token"
	if s.idTokenAttributeName != "" {
		idTokenAttribute = s.idTokenAttributeName
		s.log.Debug("Using custom id_token attribute name", "attribute_name", idTokenAttribute)
	}

	idToken := token.Extra(idTokenAttribute)
	if idToken == nil {
		s.log.Debug("No id_token found", "token", token)
		return nil
	}

	rawJSON, err := s.retrieveRawJWTPayload(idToken)
	if err != nil {
		s.log.Warn("Error retrieving id_token payload", "error", err, "token", fmt.Sprintf("%+v", token))
		return nil
	}

	return s.parseUserInfoFromJSON(rawJSON, "id_token")
}

func (s *SocialGenericOAuth) extractFromAccessToken(token *oauth2.Token) *UserInfoJson {
	s.log.Debug("Extracting user info from OAuth access token")

	accessToken := token.AccessToken
	if accessToken == "" {
		s.log.Debug("No access token found")
		return nil
	}

	rawJSON, err := s.retrieveRawJWTPayload(accessToken)
	if err != nil {
		s.log.Warn("Error retrieving access token payload", "error", err)
		return nil
	}

	return s.parseUserInfoFromJSON(rawJSON, "access_token")
}

// parseUserInfoFromJSON is a helper method to parse UserInfoJson from raw JSON and source
func (s *SocialGenericOAuth) parseUserInfoFromJSON(rawJSON []byte, source string) *UserInfoJson {
	var data UserInfoJson
	if err := json.Unmarshal(rawJSON, &data); err != nil {
		s.log.Error("Error decoding user info JSON", "raw_json", string(rawJSON), "error", err, "source", source)
		return nil
	}

	data.rawJSON = rawJSON
	data.source = source
	s.log.Debug("Parsed user info from JSON", "raw_json", string(rawJSON), "data", data.String(), "source", source)
	return &data
}

func (s *SocialGenericOAuth) extractFromAPI(ctx context.Context, client *http.Client) *UserInfoJson {
	s.log.Debug("Getting user info from API")
	if s.info.ApiUrl == "" {
		s.log.Debug("No api url configured")
		return nil
	}

	rawUserInfoResponse, err := s.httpGet(ctx, client, s.info.ApiUrl)
	if err != nil {
		s.log.Debug("Error getting user info from API", "url", s.info.ApiUrl, "error", err)
		return nil
	}

	return s.parseUserInfoFromJSON(rawUserInfoResponse.Body, "API")
}

func (s *SocialGenericOAuth) extractEmail(data *UserInfoJson) string {
	if data.Email != "" {
		return data.Email
	}

	if s.emailAttributePath != "" {
		email, err := util.SearchJSONForStringAttr(s.emailAttributePath, data.rawJSON)
		if err != nil {
			s.log.Error("Failed to search JSON for attribute", "error", err)
		} else if email != "" {
			return email
		}
	}

	emails, ok := data.Attributes[s.emailAttributeName]
	if ok && len(emails) != 0 {
		return emails[0]
	}

	if data.Upn != "" {
		emailAddr, emailErr := mail.ParseAddress(data.Upn)
		if emailErr == nil {
			return emailAddr.Address
		}
		s.log.Debug("Failed to parse e-mail address", "error", emailErr.Error())
	}

	return ""
}

func (s *SocialGenericOAuth) extractLogin(data *UserInfoJson) string {
	if data.Login != "" {
		s.log.Debug("Setting user info login from login field", "login", data.Login)
		return data.Login
	}

	if s.loginAttributePath != "" {
		s.log.Debug("Searching for login among JSON", "loginAttributePath", s.loginAttributePath)
		login, err := util.SearchJSONForStringAttr(s.loginAttributePath, data.rawJSON)
		if err != nil {
			s.log.Error("Failed to search JSON for login attribute", "error", err)
		}

		if login != "" {
			return login
		}
	}

	if data.Username != "" {
		s.log.Debug("Setting user info login from username field", "username", data.Username)
		return data.Username
	}

	return ""
}

func (s *SocialGenericOAuth) extractUserName(data *UserInfoJson) string {
	if s.nameAttributePath != "" {
		name, err := util.SearchJSONForStringAttr(s.nameAttributePath, data.rawJSON)
		if err != nil {
			s.log.Error("Failed to search JSON for attribute", "error", err)
		} else if name != "" {
			s.log.Debug("Setting user info name from nameAttributePath", "nameAttributePath", s.nameAttributePath)
			return name
		}
	}

	if data.Name != "" {
		s.log.Debug("Setting user info name from name field")
		return data.Name
	}

	if data.DisplayName != "" {
		s.log.Debug("Setting user info name from display name field")
		return data.DisplayName
	}

	s.log.Debug("Unable to find user info name")
	return ""
}

func (s *SocialGenericOAuth) extractGroups(data *UserInfoJson) ([]string, error) {
	if s.groupsAttributePath == "" {
		return []string{}, nil
	}

	return util.SearchJSONForStringSliceAttr(s.groupsAttributePath, data.rawJSON)
}

func (s *SocialGenericOAuth) fetchPrivateEmail(ctx context.Context, client *http.Client) (string, error) {
	type Record struct {
		Email       string `json:"email"`
		Primary     bool   `json:"primary"`
		IsPrimary   bool   `json:"is_primary"`
		Verified    bool   `json:"verified"`
		IsConfirmed bool   `json:"is_confirmed"`
	}

	response, err := s.httpGet(ctx, client, s.info.ApiUrl+"/emails")
	if err != nil {
		s.log.Error("Error getting email address", "url", s.info.ApiUrl+"/emails", "error", err)
		return "", fmt.Errorf("%v: %w", "Error getting email address", err)
	}

	var records []Record

	err = json.Unmarshal(response.Body, &records)
	if err != nil {
		var data struct {
			Values []Record `json:"values"`
		}

		err = json.Unmarshal(response.Body, &data)
		if err != nil {
			s.log.Error("Error decoding email addresses response", "raw_json", string(response.Body), "error", err)
			return "", fmt.Errorf("%v: %w", "Error decoding email addresses response", err)
		}

		records = data.Values
	}

	s.log.Debug("Received email addresses", "emails", records)

	var email = ""
	for _, record := range records {
		if record.Primary || record.IsPrimary {
			email = record.Email
			break
		}
	}

	s.log.Debug("Using email address", "email", email)

	return email, nil
}

func (s *SocialGenericOAuth) fetchTeamMemberships(ctx context.Context, client *http.Client) ([]string, error) {
	var err error
	var ids []string

	if s.teamsUrl == "" {
		ids, err = s.fetchTeamMembershipsFromDeprecatedTeamsUrl(ctx, client)
	} else {
		ids, err = s.fetchTeamMembershipsFromTeamsUrl(ctx, client)
	}

	if err == nil {
		s.log.Debug("Received team memberships", "ids", ids)
	}

	return ids, err
}

func (s *SocialGenericOAuth) fetchTeamMembershipsFromDeprecatedTeamsUrl(ctx context.Context, client *http.Client) ([]string, error) {
	var ids []string

	type Record struct {
		Id int `json:"id"`
	}

	response, err := s.httpGet(ctx, client, s.info.ApiUrl+"/teams")
	if err != nil {
		s.log.Error("Error getting team memberships", "url", s.info.ApiUrl+"/teams", "error", err)
		return []string{}, err
	}

	var records []Record

	err = json.Unmarshal(response.Body, &records)
	if err != nil {
		s.log.Error("Error decoding team memberships response", "raw_json", string(response.Body), "error", err)
		return []string{}, err
	}

	ids = make([]string, len(records))
	for i, record := range records {
		ids[i] = strconv.Itoa(record.Id)
	}

	return ids, nil
}

func (s *SocialGenericOAuth) fetchTeamMembershipsFromTeamsUrl(ctx context.Context, client *http.Client) ([]string, error) {
	if s.teamIdsAttributePath == "" {
		return []string{}, nil
	}

	response, err := s.httpGet(ctx, client, s.teamsUrl)
	if err != nil {
		s.log.Error("Error getting team memberships", "url", s.teamsUrl, "error", err)
		return nil, err
	}

	return util.SearchJSONForStringSliceAttr(s.teamIdsAttributePath, response.Body)
}

func (s *SocialGenericOAuth) fetchOrganizations(ctx context.Context, client *http.Client) ([]string, bool) {
	type Record struct {
		Login string `json:"login"`
	}

	response, err := s.httpGet(ctx, client, s.info.ApiUrl+"/orgs")
	if err != nil {
		s.log.Error("Error getting organizations", "url", s.info.ApiUrl+"/orgs", "error", err)
		return nil, false
	}

	var records []Record

	err = json.Unmarshal(response.Body, &records)
	if err != nil {
		s.log.Error("Error decoding organization response", "response", string(response.Body), "error", err)
		return nil, false
	}

	var logins = make([]string, len(records))
	for i, record := range records {
		logins[i] = record.Login
	}

	s.log.Debug("Received organizations", "logins", logins)

	return logins, true
}

func (s *SocialGenericOAuth) SupportBundleContent(bf *bytes.Buffer) error {
	s.reloadMutex.RLock()
	defer s.reloadMutex.RUnlock()

	bf.WriteString("## GenericOAuth specific configuration\n\n")
	bf.WriteString("```ini\n")
	fmt.Fprintf(bf, "name_attribute_path = %s\n", s.nameAttributePath)
	fmt.Fprintf(bf, "login_attribute_path = %s\n", s.loginAttributePath)
	fmt.Fprintf(bf, "id_token_attribute_name = %s\n", s.idTokenAttributeName)
	fmt.Fprintf(bf, "team_ids_attribute_path = %s\n", s.teamIdsAttributePath)
	fmt.Fprintf(bf, "team_ids = %v\n", s.teamIds)
	fmt.Fprintf(bf, "allowed_organizations = %v\n", s.allowedOrganizations)
	bf.WriteString("```\n\n")

	return s.getBaseSupportBundleContent(bf)
}

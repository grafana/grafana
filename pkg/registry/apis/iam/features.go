package iam

import (
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/setting"
)

type API string

const (
	APIRoles                API = "roles"
	APIRoleBindings         API = "rolebindings"
	APIGlobalRoles          API = "globalroles"
	APIResourcePermissions  API = "resourcepermissions"
	APITeamLBACRules        API = "teamlbacrules"
	APITeams                API = "teams"
	APIUsers                API = "users"
	APIServiceAccounts      API = "serviceaccounts"
	APIServiceAccountTokens API = "serviceaccounttokens"
	APISSOSettings          API = "ssosettings"
	APIAuthInfo             API = "authinfo"
	APIUserPermissions      API = "userpermissions"
	apiNone                 API = "none"
)

var supportedAPIs = []API{
	APIRoles,
	APIRoleBindings,
	APIGlobalRoles,
	APIResourcePermissions,
	APITeamLBACRules,
	APITeams,
	APIUsers,
	APIServiceAccounts,
	APIServiceAccountTokens,
	APISSOSettings,
	APIAuthInfo,
	APIUserPermissions,
}

type Features struct {
	RolesAPI                          bool
	RoleBindingsAPI                   bool
	GlobalRolesAPI                    bool
	ResourcePermissionsAPI            bool
	TeamLBACRulesAPI                  bool
	TeamsAPI                          bool
	UsersAPI                          bool
	ServiceAccountsAPI                bool
	ServiceAccountTokensAPI           bool
	SSOSettingsAPI                    bool
	AuthInfoAPI                       bool
	UserPermissionsAPI                bool
	ServiceAccountResourcePermissions bool
	ZanzanaSync                       bool
}

// StartupFeatures is the IAM feature snapshot resolved from Grafana's static
// configuration. An unconfigured snapshot preserves the legacy OpenFeature
// fallback during migration.
type StartupFeatures struct {
	features   Features
	configured bool
}

// ProvideStartupFeatures resolves the optional [iam] startup configuration.
func ProvideStartupFeatures(cfg *setting.Cfg) (StartupFeatures, error) {
	if cfg == nil || cfg.Raw == nil {
		return StartupFeatures{}, nil
	}

	section := cfg.Raw.Section("iam")
	apiValue := strings.TrimSpace(section.Key("api").String())
	zanzanaSync, err := parseOptionalBool(section.Key("zanzana_sync_enabled").String())
	if err != nil {
		return StartupFeatures{}, fmt.Errorf("invalid iam.zanzana_sync_enabled: %w", err)
	}
	serviceAccountResourcePermissions, err := parseOptionalBool(section.Key("service_account_resource_permissions_enabled").String())
	if err != nil {
		return StartupFeatures{}, fmt.Errorf("invalid iam.service_account_resource_permissions_enabled: %w", err)
	}

	if apiValue == "" {
		if zanzanaSync || serviceAccountResourcePermissions {
			return StartupFeatures{}, fmt.Errorf("iam.api must be configured when IAM behavior settings are enabled")
		}
		return StartupFeatures{}, nil
	}

	values := strings.Split(apiValue, ",")
	for i := range values {
		values[i] = strings.TrimSpace(values[i])
	}

	apis, err := ParseAPIs(values)
	if err != nil {
		return StartupFeatures{}, err
	}

	features := Features{
		ZanzanaSync:                       zanzanaSync,
		ServiceAccountResourcePermissions: serviceAccountResourcePermissions,
	}
	features.SetAPIs(apis)
	if err := features.Validate(); err != nil {
		return StartupFeatures{}, err
	}

	return StartupFeatures{features: features, configured: true}, nil
}

// Snapshot returns a copy of the configured features, or nil when callers
// should use the legacy OpenFeature fallback.
func (f StartupFeatures) Snapshot() *Features {
	if !f.configured {
		return nil
	}
	features := f.features
	return &features
}

func parseOptionalBool(value string) (bool, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return false, nil
	}
	return strconv.ParseBool(value)
}

func ParseAPIs(values []string) ([]API, error) {
	apis := make([]API, 0, len(values))
	seen := make(map[API]struct{}, len(values))
	for _, value := range values {
		api := API(value)
		if api == apiNone {
			if len(values) != 1 {
				return nil, fmt.Errorf("iam api %q cannot be combined with other APIs", apiNone)
			}
			return nil, nil
		}
		if !slices.Contains(supportedAPIs, api) {
			return nil, fmt.Errorf("unknown iam api %q", value)
		}
		if _, ok := seen[api]; ok {
			continue
		}
		seen[api] = struct{}{}
		apis = append(apis, api)
	}
	if len(values) == 0 {
		return nil, fmt.Errorf("at least one iam api or %q is required", apiNone)
	}
	return apis, nil
}

func (f *Features) SetAPIs(apis []API) {
	f.RolesAPI = slices.Contains(apis, APIRoles)
	f.RoleBindingsAPI = slices.Contains(apis, APIRoleBindings)
	f.GlobalRolesAPI = slices.Contains(apis, APIGlobalRoles)
	f.ResourcePermissionsAPI = slices.Contains(apis, APIResourcePermissions)
	f.TeamLBACRulesAPI = slices.Contains(apis, APITeamLBACRules)
	f.TeamsAPI = slices.Contains(apis, APITeams)
	f.UsersAPI = slices.Contains(apis, APIUsers)
	f.ServiceAccountsAPI = slices.Contains(apis, APIServiceAccounts)
	f.ServiceAccountTokensAPI = slices.Contains(apis, APIServiceAccountTokens)
	f.SSOSettingsAPI = slices.Contains(apis, APISSOSettings)
	f.AuthInfoAPI = slices.Contains(apis, APIAuthInfo)
	f.UserPermissionsAPI = slices.Contains(apis, APIUserPermissions)
}

func (f Features) EnabledAPIs() []API {
	apis := make([]API, 0, len(supportedAPIs))
	for _, api := range supportedAPIs {
		if featureForAPI(f, api) {
			apis = append(apis, api)
		}
	}
	return apis
}

func featureForAPI(f Features, api API) bool {
	switch api {
	case APIRoles:
		return f.RolesAPI
	case APIRoleBindings:
		return f.RoleBindingsAPI
	case APIGlobalRoles:
		return f.GlobalRolesAPI
	case APIResourcePermissions:
		return f.ResourcePermissionsAPI
	case APITeamLBACRules:
		return f.TeamLBACRulesAPI
	case APITeams:
		return f.TeamsAPI
	case APIUsers:
		return f.UsersAPI
	case APIServiceAccounts:
		return f.ServiceAccountsAPI
	case APIServiceAccountTokens:
		return f.ServiceAccountTokensAPI
	case APISSOSettings:
		return f.SSOSettingsAPI
	case APIAuthInfo:
		return f.AuthInfoAPI
	case APIUserPermissions:
		return f.UserPermissionsAPI
	default:
		return false
	}
}

func (f Features) Validate() error {
	if f.ServiceAccountTokensAPI && !f.ServiceAccountsAPI {
		return fmt.Errorf("iam api %q requires %q", APIServiceAccountTokens, APIServiceAccounts)
	}
	if f.ServiceAccountResourcePermissions && !f.ResourcePermissionsAPI {
		return fmt.Errorf("service account resource permissions require iam api %q", APIResourcePermissions)
	}
	return nil
}

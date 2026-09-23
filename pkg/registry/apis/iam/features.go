package iam

import (
	"fmt"
	"slices"
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

package iam

import (
	"context"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
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

// ProvideFeatures resolves the IAM startup feature set before any consumers
// are constructed. Explicit [iam] configuration takes precedence; when it is
// absent, legacy OpenFeature flags are evaluated once for staged migration.
func ProvideFeatures(cfg *setting.Cfg) (Features, error) {
	configured, err := featuresFromConfig(cfg)
	if err != nil {
		return Features{}, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return ResolveFeatures(ctx, configured, openfeature.NewDefaultClient()), nil
}

// ResolveFeatures returns explicit startup configuration when supplied, or a
// one-time snapshot of the legacy flags otherwise. The optional value is kept
// at the initialization boundary and is never passed to consumers.
func ResolveFeatures(ctx context.Context, configured *Features, client openfeature.IClient) Features {
	if configured != nil {
		return *configured
	}
	return FeaturesFromFlags(ctx, client)
}

func featuresFromConfig(cfg *setting.Cfg) (*Features, error) {
	if cfg == nil || cfg.Raw == nil {
		return nil, nil
	}

	section := cfg.SectionWithEnvOverrides("iam")
	apiValue := strings.TrimSpace(section.Key("api").String())
	zanzanaSync, err := parseOptionalBool(section.Key("zanzana_sync_enabled").String())
	if err != nil {
		return nil, fmt.Errorf("invalid iam.zanzana_sync_enabled: %w", err)
	}
	serviceAccountResourcePermissions, err := parseOptionalBool(section.Key("service_account_resource_permissions_enabled").String())
	if err != nil {
		return nil, fmt.Errorf("invalid iam.service_account_resource_permissions_enabled: %w", err)
	}

	if apiValue == "" {
		if zanzanaSync || serviceAccountResourcePermissions {
			return nil, fmt.Errorf("iam.api must be configured when IAM behavior settings are enabled")
		}
		return nil, nil
	}

	values := strings.Split(apiValue, ",")
	for i := range values {
		values[i] = strings.TrimSpace(values[i])
	}

	apis, err := ParseAPIs(values)
	if err != nil {
		return nil, err
	}

	features := Features{
		ZanzanaSync:                       zanzanaSync,
		ServiceAccountResourcePermissions: serviceAccountResourcePermissions,
	}
	features.SetAPIs(apis)
	if err := features.Validate(); err != nil {
		return nil, err
	}

	return &features, nil
}

func parseOptionalBool(value string) (bool, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return false, nil
	}
	return strconv.ParseBool(value)
}

// FeaturesFromFlags evaluates the legacy IAM startup flags into one resolved startup value.
func FeaturesFromFlags(ctx context.Context, client openfeature.IClient) Features {
	flag := func(key string) bool {
		return client.Boolean(ctx, key, false, openfeature.TransactionContext(ctx))
	}

	return Features{
		RolesAPI:                          flag(featuremgmt.FlagKubernetesAuthzRolesApi),
		RoleBindingsAPI:                   flag(featuremgmt.FlagKubernetesAuthzRoleBindingsApi),
		GlobalRolesAPI:                    flag(featuremgmt.FlagKubernetesAuthzGlobalRolesApi),
		ResourcePermissionsAPI:            flag(featuremgmt.FlagKubernetesAuthzResourcePermissionApis),
		TeamLBACRulesAPI:                  flag(featuremgmt.FlagKubernetesAuthzTeamLBACRuleApi),
		TeamsAPI:                          flag(featuremgmt.FlagKubernetesTeamsApi),
		UsersAPI:                          flag(featuremgmt.FlagKubernetesUsersApi),
		ServiceAccountsAPI:                flag(featuremgmt.FlagKubernetesServiceAccountsApi),
		ServiceAccountTokensAPI:           flag(featuremgmt.FlagKubernetesServiceAccountTokensApi),
		SSOSettingsAPI:                    flag(featuremgmt.FlagKubernetesSsoSettingsApi),
		AuthInfoAPI:                       flag(featuremgmt.FlagKubernetesAuthInfoApi),
		UserPermissionsAPI:                flag(featuremgmt.FlagAuthzUserPermissions),
		ServiceAccountResourcePermissions: flag(featuremgmt.FlagKubernetesAuthzServiceAccountResourcePermissions),
		ZanzanaSync:                       flag(featuremgmt.FlagKubernetesAuthzZanzanaSync),
	}
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

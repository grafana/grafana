package accesscontrol

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/org"
)

const (
	CacheHit  = "hit"
	CacheMiss = "miss"
)

var (
	ErrInternal        = errutil.Internal("accesscontrol.internal")
	CacheUsageStatuses = []string{CacheHit, CacheMiss}
)

// RoleRegistration stores a role and its assignments to built-in roles
// (Viewer, Editor, Admin, Grafana Admin)
type RoleRegistration struct {
	Role    RoleDTO
	Grants  []string
	Exclude []string
}

// Role is the model for Role in RBAC.
type Role struct {
	ID          int64  `json:"-" xorm:"pk autoincr 'id'"`
	OrgID       int64  `json:"-" xorm:"org_id"`
	Version     int64  `json:"version"`
	UID         string `xorm:"uid" json:"uid"`
	Name        string `json:"name"`
	DisplayName string `json:"displayName,omitempty"`
	Group       string `xorm:"group_name" json:"group"`
	Description string `json:"description"`
	Hidden      bool   `json:"hidden"`

	Updated time.Time `json:"updated"`
	Created time.Time `json:"created"`
}

func (r *Role) Global() bool {
	return r.OrgID == GlobalOrgID
}

func (r *Role) IsFixed() bool {
	return strings.HasPrefix(r.Name, FixedRolePrefix)
}

func (r *Role) IsBasic() bool {
	return strings.HasPrefix(r.Name, BasicRolePrefix) || strings.HasPrefix(r.UID, BasicRoleUIDPrefix)
}

func (r Role) MarshalJSON() ([]byte, error) {
	type Alias Role

	return json.Marshal(&struct {
		Alias
		Global bool `json:"global" xorm:"-"`
	}{
		Alias:  (Alias)(r),
		Global: r.Global(),
	})
}

// swagger:ignore
type RoleDTO struct {
	Version     int64        `json:"version"`
	UID         string       `xorm:"uid" json:"uid"`
	Name        string       `json:"name"`
	DisplayName string       `json:"displayName,omitempty"`
	Description string       `json:"description"`
	Group       string       `xorm:"group_name" json:"group"`
	Permissions []Permission `json:"permissions,omitempty"`
	Delegatable *bool        `json:"delegatable,omitempty"`
	Mapped      bool         `json:"mapped,omitempty"`
	Hidden      bool         `json:"hidden,omitempty"`

	ID    int64 `json:"-" xorm:"pk autoincr 'id'"`
	OrgID int64 `json:"-" xorm:"org_id"`

	Updated time.Time `json:"updated"`
	Created time.Time `json:"created"`
}

func (r *RoleDTO) LogID() string {
	var org string

	if r.Global() {
		org = "Global"
	} else {
		org = fmt.Sprintf("OrgId:%v", r.OrgID)
	}

	if r.UID != "" {
		return fmt.Sprintf("[%s RoleUID:%v]", org, r.UID)
	}
	return fmt.Sprintf("[%s Role:%v]", org, r.Name)
}

func (r *RoleDTO) Role() Role {
	return Role{
		ID:          r.ID,
		OrgID:       r.OrgID,
		UID:         r.UID,
		Version:     r.Version,
		Name:        r.Name,
		DisplayName: r.DisplayName,
		Group:       r.Group,
		Description: r.Description,
		Hidden:      r.Hidden,
		Updated:     r.Updated,
		Created:     r.Created,
	}
}

func (r *RoleDTO) Global() bool {
	return r.OrgID == GlobalOrgID
}

func (r *RoleDTO) IsManaged() bool {
	return strings.HasPrefix(r.Name, ManagedRolePrefix)
}

func (r *RoleDTO) IsFixed() bool {
	return strings.HasPrefix(r.Name, FixedRolePrefix)
}

func (r *RoleDTO) IsPlugin() bool {
	return strings.HasPrefix(r.Name, PluginRolePrefix)
}

func (r *RoleDTO) IsBasic() bool {
	return strings.HasPrefix(r.Name, BasicRolePrefix) || strings.HasPrefix(r.UID, BasicRoleUIDPrefix)
}

func (r *RoleDTO) IsExternalService() bool {
	return strings.HasPrefix(r.Name, ExternalServiceRolePrefix) || strings.HasPrefix(r.UID, ExternalServiceRoleUIDPrefix)
}

// swagger:model RoleDTO
type RoleDTOStatic struct {
	RoleDTO
	Global bool `json:"global" xorm:"-"`
}

func (r RoleDTO) MarshalJSON() ([]byte, error) {
	type Alias RoleDTO

	return json.Marshal(&struct {
		Alias
		Global bool `json:"global" xorm:"-"`
	}{
		Alias:  (Alias)(r),
		Global: r.Global(),
	})
}

type TeamRole struct {
	ID     int64 `json:"id" xorm:"pk autoincr 'id'"`
	OrgID  int64 `json:"orgId" xorm:"org_id"`
	RoleID int64 `json:"roleId" xorm:"role_id"`
	TeamID int64 `json:"teamId" xorm:"team_id"`

	Created time.Time
}

type UserRole struct {
	ID              int64  `json:"id" xorm:"pk autoincr 'id'"`
	OrgID           int64  `json:"orgId" xorm:"org_id"`
	RoleID          int64  `json:"roleId" xorm:"role_id"`
	UserID          int64  `json:"userId" xorm:"user_id"`
	GroupMappingUID string `json:"groupMappingUID" xorm:"group_mapping_uid"`

	Created time.Time
}

type BuiltinRole struct {
	ID     int64 `json:"id" xorm:"pk autoincr 'id'"`
	RoleID int64 `json:"roleId" xorm:"role_id"`
	OrgID  int64 `json:"orgId" xorm:"org_id"`
	Role   string

	Updated time.Time
	Created time.Time
}

// Permission is the model for access control permissions.
type Permission struct {
	ID     int64  `json:"-" xorm:"pk autoincr 'id'"`
	RoleID int64  `json:"-" xorm:"role_id"`
	Action string `json:"action"`
	Scope  string `json:"scope"`

	Kind       string `json:"-"`
	Attribute  string `json:"-"`
	Identifier string `json:"-"`

	Updated time.Time `json:"updated"`
	Created time.Time `json:"created"`
}

func (p Permission) OSSPermission() Permission {
	return Permission{
		Action: p.Action,
		Scope:  p.Scope,
	}
}

// SplitScope returns kind, attribute and Identifier
func (p Permission) SplitScope() (string, string, string) {
	return SplitScope(p.Scope)
}

type GetUserPermissionsQuery struct {
	OrgID        int64
	UserID       int64
	Roles        []string
	TeamIDs      []int64
	RolePrefixes []string
}

// ResourcePermission is structure that holds all actions that either a team / user / builtin-role
// can perform against specific resource.
type ResourcePermission struct {
	ID               int64
	RoleName         string
	Actions          []string
	Scope            string
	UserID           int64
	UserUID          string
	UserLogin        string
	UserEmail        string
	TeamID           int64
	TeamUID          string
	TeamEmail        string
	Team             string
	BuiltInRole      string
	IsManaged        bool
	IsInherited      bool
	IsServiceAccount bool
	Created          time.Time
	Updated          time.Time
}

func (p *ResourcePermission) Contains(targetActions []string) bool {
	if len(p.Actions) < len(targetActions) {
		return false
	}

	var contain = func(arr []string, s string) bool {
		for _, item := range arr {
			if item == s {
				return true
			}
		}
		return false
	}

	for _, a := range targetActions {
		if !contain(p.Actions, a) {
			return false
		}
	}

	return true
}

type SetResourcePermissionCommand struct {
	UserID      int64  `json:"userId,omitempty"`
	TeamID      int64  `json:"teamId,omitempty"`
	BuiltinRole string `json:"builtInRole,omitempty"`
	Permission  string `json:"permission"`
}

type SaveExternalServiceRoleCommand struct {
	AssignmentOrgID   int64
	ExternalServiceID string
	ServiceAccountID  int64
	Permissions       []Permission
}

func (cmd *SaveExternalServiceRoleCommand) Validate() error {
	if cmd.ExternalServiceID == "" {
		return errors.New("external service id not specified")
	}

	// slugify the external service id ID for the role to have correct name and uid
	cmd.ExternalServiceID = slugify.Slugify(cmd.ExternalServiceID)

	// Check and deduplicate permissions
	if len(cmd.Permissions) == 0 {
		return errors.New("no permissions provided")
	}
	dedupMap := map[Permission]bool{}
	dedup := make([]Permission, 0, len(cmd.Permissions))
	for i := range cmd.Permissions {
		if len(cmd.Permissions[i].Action) == 0 {
			return fmt.Errorf("external service %v requests a permission with no Action", cmd.ExternalServiceID)
		}
		if dedupMap[cmd.Permissions[i]] {
			continue
		}
		dedupMap[cmd.Permissions[i]] = true
		dedup = append(dedup, cmd.Permissions[i])
	}
	cmd.Permissions = dedup

	if cmd.ServiceAccountID <= 0 {
		return fmt.Errorf("invalid service account id %d", cmd.ServiceAccountID)
	}

	return nil
}

const (
	GlobalOrgID      = 0
	NoOrgID          = int64(-1)
	GeneralFolderUID = "general"
	K6FolderUID      = "k6-app"
	RoleGrafanaAdmin = "Grafana Admin"

	// Users actions
	ActionUsersRead  = "users:read"
	ActionUsersWrite = "users:write"

	// We can ignore gosec G101 since this does not contain any credentials.
	// nolint:gosec
	ActionUsersAuthTokenList = "users.authtoken:read"
	// We can ignore gosec G101 since this does not contain any credentials.
	// nolint:gosec
	ActionUsersAuthTokenUpdate = "users.authtoken:write"
	// We can ignore gosec G101 since this does not contain any credentials.
	// nolint:gosec
	ActionUsersPasswordUpdate    = "users.password:write"
	ActionUsersDelete            = "users:delete"
	ActionUsersCreate            = "users:create"
	ActionUsersEnable            = "users:enable"
	ActionUsersDisable           = "users:disable"
	ActionUsersPermissionsUpdate = "users.permissions:write"
	ActionUsersLogout            = "users:logout"
	ActionUsersQuotasList        = "users.quotas:read"
	ActionUsersQuotasUpdate      = "users.quotas:write"
	ActionUsersPermissionsRead   = "users.permissions:read"

	// Org actions
	ActionOrgsRead             = "orgs:read"
	ActionOrgsPreferencesRead  = "orgs.preferences:read"
	ActionOrgsQuotasRead       = "orgs.quotas:read"
	ActionOrgsWrite            = "orgs:write"
	ActionOrgsPreferencesWrite = "orgs.preferences:write"
	ActionOrgsQuotasWrite      = "orgs.quotas:write"
	ActionOrgsDelete           = "orgs:delete"
	ActionOrgsCreate           = "orgs:create"

	ActionOrgUsersRead   = "org.users:read"
	ActionOrgUsersAdd    = "org.users:add"
	ActionOrgUsersRemove = "org.users:remove"
	ActionOrgUsersWrite  = "org.users:write"

	// LDAP actions
	ActionLDAPUsersRead    = "ldap.user:read"
	ActionLDAPUsersSync    = "ldap.user:sync"
	ActionLDAPStatusRead   = "ldap.status:read"
	ActionLDAPConfigReload = "ldap.config:reload"

	// Server actions
	ActionServerStatsRead = "server.stats:read"

	// Settings actions
	ActionSettingsRead  = "settings:read"
	ActionSettingsWrite = "settings:write"

	// Datasources actions
	ActionDatasourcesExplore = "datasources:explore"

	// Global Scopes
	ScopeGlobalUsersAll = "global.users:*"

	// APIKeys scope
	ScopeAPIKeysAll = "apikeys:*"

	// Users scope
	ScopeUsersAll    = "users:*"
	ScopeUsersPrefix = "users:id:"

	// Settings scope
	ScopeSettingsAll  = "settings:*"
	ScopeSettingsSAML = "settings:auth.saml:*"

	// Team related actions
	ActionTeamsCreate           = "teams:create"
	ActionTeamsDelete           = "teams:delete"
	ActionTeamsRead             = "teams:read"
	ActionTeamsWrite            = "teams:write"
	ActionTeamsPermissionsRead  = "teams.permissions:read"
	ActionTeamsPermissionsWrite = "teams.permissions:write"

	// Team related scopes
	ScopeTeamsAll = "teams:*"

	// Annotations related actions
	ActionAnnotationsCreate = "annotations:create"
	ActionAnnotationsDelete = "annotations:delete"
	ActionAnnotationsRead   = "annotations:read"
	ActionAnnotationsWrite  = "annotations:write"

	// Alert scopes are divided into two groups. The internal (to Grafana) and the external ones.
	// For the Grafana ones, given we have ACID control we're able to provide better granularity by defining CRUD options.
	// For the external ones, we only have read and write permissions due to the lack of atomicity control of the external system.

	// Alerting rules actions
	ActionAlertingRuleCreate = "alert.rules:create"
	ActionAlertingRuleRead   = "alert.rules:read"
	ActionAlertingRuleUpdate = "alert.rules:write"
	ActionAlertingRuleDelete = "alert.rules:delete"

	// Alerting instances (+silences) actions
	ActionAlertingInstanceCreate = "alert.instances:create"
	ActionAlertingInstanceUpdate = "alert.instances:write"
	ActionAlertingInstanceRead   = "alert.instances:read"

	ActionAlertingSilencesRead   = "alert.silences:read"
	ActionAlertingSilencesCreate = "alert.silences:create"
	ActionAlertingSilencesWrite  = "alert.silences:write"

	// Alerting Notification actions (legacy)
	ActionAlertingNotificationsRead  = "alert.notifications:read"
	ActionAlertingNotificationsWrite = "alert.notifications:write"

	// Alerting notifications template actions
	ActionAlertingNotificationsTemplatesRead   = "alert.notifications.templates:read"
	ActionAlertingNotificationsTemplatesWrite  = "alert.notifications.templates:write"
	ActionAlertingNotificationsTemplatesDelete = "alert.notifications.templates:delete"

	// Alerting notifications time interval actions
	ActionAlertingNotificationsTimeIntervalsRead   = "alert.notifications.time-intervals:read"
	ActionAlertingNotificationsTimeIntervalsWrite  = "alert.notifications.time-intervals:write"
	ActionAlertingNotificationsTimeIntervalsDelete = "alert.notifications.time-intervals:delete"

	// Alerting receiver actions
	ActionAlertingReceiversList             = "alert.notifications.receivers:list"
	ActionAlertingReceiversRead             = "alert.notifications.receivers:read"
	ActionAlertingReceiversReadSecrets      = "alert.notifications.receivers.secrets:read"
	ActionAlertingReceiversCreate           = "alert.notifications.receivers:create"
	ActionAlertingReceiversUpdate           = "alert.notifications.receivers:write"
	ActionAlertingReceiversDelete           = "alert.notifications.receivers:delete"
	ActionAlertingReceiversTest             = "alert.notifications.receivers:test"
	ActionAlertingReceiversPermissionsRead  = "receivers.permissions:read"
	ActionAlertingReceiversPermissionsWrite = "receivers.permissions:write"

	// Alerting routes policies actions
	ActionAlertingRoutesRead  = "alert.notifications.routes:read"
	ActionAlertingRoutesWrite = "alert.notifications.routes:write"

	// External alerting rule actions. We can only narrow it down to writes or reads, as we don't control the atomicity in the external system.
	ActionAlertingRuleExternalWrite = "alert.rules.external:write"
	ActionAlertingRuleExternalRead  = "alert.rules.external:read"

	// External alerting instances actions. We can only narrow it down to writes or reads, as we don't control the atomicity in the external system.
	ActionAlertingInstancesExternalWrite = "alert.instances.external:write"
	ActionAlertingInstancesExternalRead  = "alert.instances.external:read"

	// External alerting notifications actions. We can only narrow it down to writes or reads, as we don't control the atomicity in the external system.
	ActionAlertingNotificationsExternalWrite = "alert.notifications.external:write"
	ActionAlertingNotificationsExternalRead  = "alert.notifications.external:read"

	// Alerting provisioning actions
	ActionAlertingProvisioningRead               = "alert.provisioning:read"
	ActionAlertingProvisioningReadSecrets        = "alert.provisioning.secrets:read"
	ActionAlertingProvisioningWrite              = "alert.provisioning:write"
	ActionAlertingRulesProvisioningRead          = "alert.rules.provisioning:read"
	ActionAlertingRulesProvisioningWrite         = "alert.rules.provisioning:write"
	ActionAlertingNotificationsProvisioningRead  = "alert.notifications.provisioning:read"
	ActionAlertingNotificationsProvisioningWrite = "alert.notifications.provisioning:write"

	// ActionAlertingProvisioningSetStatus Gives access to set provisioning status to alerting resources. Cannot be used alone. Only in conjunction with other permissions.
	ActionAlertingProvisioningSetStatus = "alert.provisioning.provenance:write"

	// Feature Management actions
	ActionFeatureManagementRead  = "featuremgmt.read"
	ActionFeatureManagementWrite = "featuremgmt.write"

	// Library Panel actions
	ActionLibraryPanelsCreate = "library.panels:create"
	ActionLibraryPanelsRead   = "library.panels:read"
	ActionLibraryPanelsWrite  = "library.panels:write"
	ActionLibraryPanelsDelete = "library.panels:delete"

	// Usage stats actions
	ActionUsageStatsRead = "server.usagestats.report:read"
)

var (
	// Team scope
	ScopeTeamsID = Scope("teams", "id", Parameter(":teamId"))

	ScopeSettingsOAuth = func(provider string) string {
		return Scope("settings", "auth."+provider, "*")
	}

	ScopeSettingsLDAP = Scope("settings", "auth.ldap", "*")

	// Annotation scopes
	ScopeAnnotationsRoot             = "annotations"
	ScopeAnnotationsProvider         = NewScopeProvider(ScopeAnnotationsRoot)
	ScopeAnnotationsAll              = ScopeAnnotationsProvider.GetResourceAllScope()
	ScopeAnnotationsID               = Scope(ScopeAnnotationsRoot, "id", Parameter(":annotationId"))
	ScopeAnnotationsTypeDashboard    = ScopeAnnotationsProvider.GetResourceScopeType(annotations.Dashboard.String())
	ScopeAnnotationsTypeOrganization = ScopeAnnotationsProvider.GetResourceScopeType(annotations.Organization.String())
)

func BuiltInRolesWithParents(builtInRoles []string) map[string]struct{} {
	res := map[string]struct{}{}

	for _, br := range builtInRoles {
		res[br] = struct{}{}
		if br != RoleGrafanaAdmin {
			for _, parent := range org.RoleType(br).Parents() {
				res[string(parent)] = struct{}{}
			}
		}
	}

	return res
}

// Evaluators

// TeamsAccessEvaluator is used to protect the "Configuration > Teams" page access
// grants access to a user when they can either create teams or can read and update a team
var TeamsAccessEvaluator = EvalAny(
	EvalPermission(ActionTeamsCreate),
	EvalAll(
		EvalPermission(ActionTeamsRead),
		EvalAny(
			EvalPermission(ActionTeamsWrite),
			EvalPermission(ActionTeamsPermissionsWrite),
			EvalPermission(ActionTeamsPermissionsRead),
		),
	),
)

// TeamsEditAccessEvaluator is used to protect the "Configuration > Teams > edit" page access
var TeamsEditAccessEvaluator = EvalAll(
	EvalPermission(ActionTeamsRead),
	EvalAny(
		EvalPermission(ActionTeamsCreate),
		EvalPermission(ActionTeamsWrite),
		EvalPermission(ActionTeamsPermissionsWrite),
	),
)

// OrgPreferencesAccessEvaluator is used to protect the "Configure > Preferences" page access
var OrgPreferencesAccessEvaluator = EvalAny(
	EvalAll(
		EvalPermission(ActionOrgsRead),
		EvalPermission(ActionOrgsWrite),
	),
	EvalAll(
		EvalPermission(ActionOrgsPreferencesRead),
		EvalPermission(ActionOrgsPreferencesWrite),
	),
)

// OrgsAccessEvaluator is used to protect the "Server Admin > Orgs" page access
// (you need to have read access to update or delete orgs; read is the minimum)
var OrgsAccessEvaluator = EvalPermission(ActionOrgsRead)

// OrgsCreateAccessEvaluator is used to protect the "Server Admin > Orgs > New Org" page access
var OrgsCreateAccessEvaluator = EvalAll(
	EvalPermission(ActionOrgsRead),
	EvalPermission(ActionOrgsCreate),
)

type QueryWithOrg struct {
	OrgId  *int64 `json:"orgId"`
	Global bool   `json:"global"`
}

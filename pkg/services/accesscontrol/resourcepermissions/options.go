package resourcepermissions

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/web"
)

type ResourceValidator func(ctx context.Context, orgID int64, resourceID string) error
type InheritedScopesSolver func(ctx context.Context, orgID int64, resourceID string) ([]string, error)
type ResourceTranslator func(ctx context.Context, orgID int64, resourceID string) (string, error)
type ParentFolderResolver func(ctx context.Context, namespace string, resourceID string, dynamicClient dynamic.Interface) (string, error)
type Options struct {
	// Resource is the action and scope prefix that is generated
	Resource string
	// ResourceAttribute is the attribute the scope should be based on (e.g. id or uid)
	ResourceAttribute string
	// APIGroup is the Kubernetes API group for the resource (e.g. "folder.grafana.app")
	// If not set, defaults to "{Resource}.grafana.app"
	APIGroup string
	// K8sActionFormat enables Kubernetes-native action and scope format.
	// When enabled, actions use "{APIGroup}/{Resource}:get_permissions" format
	// instead of "{Resource}.permissions:read" format.
	// Requires APIGroup to be non-empty.
	K8sActionFormat bool
	// OnlyManaged will tell the service to return all permissions if set to false and only managed permissions if set to true
	OnlyManaged bool
	// ResourceTranslator is a translator function that will be called before each action, it can be used to translate a resource id to a different format.
	// If set to nil the translator will be skipped
	ResourceTranslator ResourceTranslator
	// ResourceValidator is a validator function that will be called before each assignment.
	// If set to nil the validator will be skipped
	ResourceValidator ResourceValidator
	// Assignments decides what we can assign permissions to (users/teams/builtInRoles)
	Assignments Assignments
	// PermissionsToAction is a map of friendly named permissions and what access control actions they should generate.
	// E.g. Edit permissions should generate dashboards:read, dashboards:write and dashboards:delete
	PermissionsToActions map[string][]string
	// ReaderRoleName is the display name for the generated fixed reader role
	ReaderRoleName string
	// WriterRoleName is the display name for the generated fixed writer role
	WriterRoleName string
	// RoleGroup is the group name for the generated fixed roles
	RoleGroup string
	// OnSetUser if configured will be called each time a permission is set for a user
	OnSetUser func(session *db.Session, orgID int64, user accesscontrol.User, resourceID, permission string) error
	// OnSetTeam if configured will be called each time a permission is set for a team
	OnSetTeam func(session *db.Session, orgID, teamID int64, resourceID, permission string) error
	// OnSetBuiltInRole if configured will be called each time a permission is set for a built-in role
	OnSetBuiltInRole func(session *db.Session, orgID int64, builtInRole, resourceID, permission string) error
	// InheritedScopesSolver if configured can generate additional scopes that will be used when fetching permissions for a resource
	InheritedScopesSolver InheritedScopesSolver
	// GetParentFolder if configured returns the parent folder UID for a resource
	// Used for inherited permissions in K8s API. If not set, only direct permissions are returned
	GetParentFolder ParentFolderResolver
	// LicenseMV if configured is applied to endpoints that can modify permissions
	LicenseMW web.Handler
	// RestConfigProvider if configured enables K8s API redirect for resource permissions
	RestConfigProvider apiserver.DirectRestConfigProvider
	// RequestValidator if configured is called before each handler. Return an error to abort the request.
	// The returned context, if non-nil, replaces the request context for subsequent processing.
	// This allows validators to cache resource metadata in the context so that downstream Set* methods
	// can read it without an additional DB lookup. Return (nil, nil) on success if no enrichment needed.
	RequestValidator func(r *http.Request, orgID int64, resourceID string) (context.Context, error)
	// DatasourceTypeResolver if configured resolves the datasource plugin type for a given resource UID.
	// Only set for datasource permission services. Used to populate datasource_type on new permission rows.
	DatasourceTypeResolver func(ctx context.Context, orgID int64, resourceID string) (string, error)
}

// GetAction returns the permission action string for a given verb.
// K8s:    "{APIGroup}/{Resource}:get_permissions" (read) or "{APIGroup}/{Resource}:set_permissions" (write)
// Legacy: "{Resource}.permissions:read" or "{Resource}.permissions:write"
func (o *Options) GetAction(verb string) string {
	if o.K8sActionFormat {
		k8sVerb := map[string]string{"read": utils.VerbGetPermissions, "write": utils.VerbSetPermissions}[verb]
		return fmt.Sprintf("%s/%s:%s", o.APIGroup, o.Resource, k8sVerb)
	}
	return fmt.Sprintf("%s.permissions:%s", o.Resource, verb)
}

// GetScope returns a scope string using the appropriate resource prefix.
// K8s:    "{APIGroup}/{Resource}:{parts[0]}:{parts[1]}:..."
// Legacy: "{Resource}:{parts[0]}:{parts[1]}:..."
func (o *Options) GetScope(parts ...string) string {
	if o.K8sActionFormat {
		prefix := fmt.Sprintf("%s/%s", o.APIGroup, o.Resource)
		return accesscontrol.Scope(append([]string{prefix}, parts...)...)
	}
	return accesscontrol.Scope(append([]string{o.Resource}, parts...)...)
}

// GetActionSetName returns the action set name for a given permission.
// K8s:    "{APIGroup}/{Resource}:{permission}" (lowercased)
// Legacy: "{Resource}:{permission}" (lowercased)
func (o *Options) GetActionSetName(permission string) string {
	resource := strings.ToLower(o.Resource)
	permission = strings.ToLower(permission)
	if o.K8sActionFormat {
		return fmt.Sprintf("%s/%s:%s", strings.ToLower(o.APIGroup), resource, permission)
	}
	return fmt.Sprintf("%s:%s", resource, permission)
}

// GetRoleName returns a fixed role name with the given suffix.
// K8s:    "fixed:{APIGroup}:{Resource}.permissions:{suffix}"
// Legacy: "fixed:{Resource}.permissions:{suffix}"
func (o *Options) GetRoleName(suffix string) string {
	if o.K8sActionFormat {
		return fmt.Sprintf("fixed:%s:%s.permissions:%s", o.APIGroup, o.Resource, suffix)
	}
	return fmt.Sprintf("fixed:%s.permissions:%s", o.Resource, suffix)
}

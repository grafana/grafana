package resourcepermission

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/authlib/types"

	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	idStore "github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
)

var (
	timeNow = func() time.Time { return time.Now() }

	errDatabaseHelper       = errors.New("failed to get database")
	errNotImplemented       = errors.New("not supported by this storage backend")
	errNameMismatch         = errors.New("name mismatch")
	errNamespaceMismatch    = errors.New("namespace mismatch")
	errUnknownGroupResource = errors.New("unknown group/resource")
	errNotFound             = errors.New("not found")
	errConflict             = errors.New("conflict")
	errInvalidSpec          = errors.New("invalid spec")
	errInvalidName          = errors.New("invalid name")
	errInvalidScope         = errors.New("invalid scope")
	errInvalidNamespace     = errors.New("invalid namespace")

	defaultLevels     = []string{"view", "edit", "admin"}
	allowedBasicRoles = map[string]bool{"Viewer": true, "Editor": true, "Admin": true}
)

// IdentityStore is a type alias for legacy.ScopeResolverStore — the minimal
// identity-lookup interface for resolving uid↔id scopes.
type IdentityStore = idStore.ScopeResolverStore

type PageQuery struct {
	ScopePatterns []string
	OrgID         int64
	Pagination    common.Pagination
}

type ListResourcePermissionsQuery struct {
	Scopes     []string
	OrgID      int64
	ActionSets []string
	// SubjectUID filters by subject (user UID, team UID, or builtin role name). When set, only permissions assigned to this subject are returned.
	SubjectUID string
}

type DeleteResourcePermissionsQuery struct {
	Scope    string
	OrgID    int64
	RoleName string
}

type rbacAssignmentCreate struct {
	Action           string // e.g. "dashboards:edit"
	Scope            string // e.g. "folders:uid:1"
	RoleName         string // e.g. "managed:users:1:permissions
	SubjectID        any    // int64 for user/team, string for builtin_role
	AssignmentTable  string // "user_role", "team_role", or "builtin_role"
	AssignmentColumn string // "user_id", "team_id", or "role"
	DatasourceType   string // e.g. "loki"
}

func (g *rbacAssignmentCreate) permission() accesscontrol.Permission {
	p := accesscontrol.Permission{
		Action:         g.Action,
		Scope:          g.Scope,
		DatasourceType: g.DatasourceType,
	}
	p.Kind, p.Attribute, p.Identifier = accesscontrol.SplitScope(p.Scope)
	return p
}

type rbacAssignment struct {
	ID               int64     `xorm:"id"`
	Action           string    `xorm:"action"`
	Scope            string    `xorm:"scope"`
	Created          time.Time `xorm:"created"`
	Updated          time.Time `xorm:"updated"`
	RoleName         string    `xorm:"role_name"`
	SubjectUID       string    `xorm:"subject_uid"`
	SubjectType      string    `xorm:"subject_type"` // 'user', 'team', or 'builtin_role'
	IsServiceAccount bool      `xorm:"is_service_account"`
	DatasourceType   string    `xorm:"datasource_type"`
}

// newV0ResourcePermission creates a new v0alpha1.ResourcePermission from the given groupResourceName and permission specs.
// Specs are sorted for consistency, created and updated are used for the metadata timestamps and resourceVersion is set to the updated timestamp in milliseconds.
func newV0ResourcePermission(grn *groupResourceName, specs []v0alpha1.ResourcePermissionspecPermission, created, updated time.Time, namespace string) v0alpha1.ResourcePermission {
	// Sort specs for consistency
	sort.Slice(specs, func(i, j int) bool {
		if specs[i].Kind != specs[j].Kind {
			return specs[i].Kind < specs[j].Kind
		}
		if specs[i].Name != specs[j].Name {
			return specs[i].Name < specs[j].Name
		}
		return specs[i].Verb < specs[j].Verb
	})

	r := v0alpha1.ResourcePermission{
		TypeMeta: v0alpha1.ResourcePermissionInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:              grn.string(),
			Namespace:         namespace,
			ResourceVersion:   fmt.Sprint(updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(created.UTC()),
		},
		Spec: v0alpha1.ResourcePermissionSpec{
			Resource:    grn.v0alpha1(),
			Permissions: specs,
		},
	}
	r.SetUpdateTimestamp(updated.UTC())
	r.UID = gapiutil.CalculateClusterWideUID(&r)
	return r
}

// toV0ResourcePermissions translates a list of rbacAssignments into a list of v0alpha1.ResourcePermissions.
// it is assumed that assignments are sorted by scope. it translates id-scoped permissions back to uid-scoped permissions.
func (s *ResourcePermSqlBackend) toV0ResourcePermissions(ctx context.Context, ns types.NamespaceInfo, assignments []rbacAssignment) ([]v0alpha1.ResourcePermission, error) {
	if len(assignments) == 0 {
		return nil, nil
	}

	var (
		created        = assignments[0].Created
		updated        = assignments[0].Updated
		permissionKind v0alpha1.ResourcePermissionSpecPermissionKind

		resourcePermissions = make([]v0alpha1.ResourcePermission, 0, 8)
		specs               = make([]v0alpha1.ResourcePermissionspecPermission, 0, 4)
		// scopeCache avoids repeated DB lookups for the same id-scoped scope within a single list response.
		scopeCache = make(map[string]*groupResourceName, len(assignments))
	)

	logger := s.logger.FromContext(ctx)

	// parseScopeCtxCached resolves and caches scope→GRN lookups.
	// Returns (nil, nil) for orphaned id-scoped rows so callers can skip them.
	parseScopeCtxCached := func(scope, datasourceType string) (*groupResourceName, error) {
		key := scope + ":" + datasourceType
		if grn, ok := scopeCache[key]; ok {
			return grn, nil
		}
		grn, err := s.mappers.ParseScopeCtx(ctx, ns, s.identityStore, scope, datasourceType)
		if err != nil {
			if idStore.IsNotFoundError(err) {
				logger.Warn("Dropping permission with orphaned scope", "scope", scope, "error", err)
				scopeCache[key] = nil
				return nil, nil
			}
			return nil, err
		}
		scopeCache[key] = grn
		return grn, nil
	}

	grn, err := parseScopeCtxCached(assignments[0].Scope, assignments[0].DatasourceType)
	if err != nil {
		return nil, err
	}

	for _, assign := range assignments {
		// Ensure all assignments belong to the same resource
		parsedGrn, err := parseScopeCtxCached(assign.Scope, assign.DatasourceType)
		if err != nil {
			return nil, err
		}
		if parsedGrn == nil {
			continue
		}
		if grn == nil {
			grn = parsedGrn
			created = assign.Created
			updated = assign.Updated
		}
		// If it's a new resource, flush the current specs to a ResourcePermission and start a new one
		if *parsedGrn != *grn {
			if len(specs) > 0 {
				resourcePermissions = append(
					resourcePermissions,
					newV0ResourcePermission(grn, specs, created, updated, ns.Value),
				)
			}

			// Reset for the new resource
			grn = parsedGrn
			specs = make([]v0alpha1.ResourcePermissionspecPermission, 0, 4)
			created = assign.Created
			updated = assign.Updated
		}

		// Find the most recent updated time
		if assign.Updated.After(updated) {
			updated = assign.Updated
		}
		// Find the oldest created time
		if assign.Created.Before(created) {
			created = assign.Created
		}

		// Determine permission kind
		switch assign.SubjectType {
		case "user":
			if assign.IsServiceAccount {
				permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount
			} else {
				permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindUser
			}
		case "team":
			permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindTeam
		case "builtin_role":
			permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindBasicRole
		default:
			return nil, errors.New("unknown subject type: " + assign.SubjectType)
		}

		// Determine verb from action
		actionParts := strings.SplitN(assign.Action, ":", 2)
		if len(actionParts) < 2 || actionParts[1] == "" {
			return nil, fmt.Errorf("invalid action format: %s", assign.Action)
		}
		verb := actionParts[1]

		// Append the translated permission spec
		specs = append(specs, v0alpha1.ResourcePermissionspecPermission{
			Kind: permissionKind,
			Name: assign.SubjectUID,
			Verb: verb,
		})
	}

	// Flush the final resource (grn may be nil if all assignments were orphaned)
	if grn != nil && len(specs) > 0 {
		resourcePermissions = append(
			resourcePermissions,
			newV0ResourcePermission(grn, specs, created, updated, ns.Value),
		)
	}

	return resourcePermissions, nil
}

type groupResourceName struct {
	Group    string
	Resource string
	Name     string
}

func (g *groupResourceName) string() string {
	return g.Group + "-" + g.Resource + "-" + g.Name
}

func (g *groupResourceName) v0alpha1() v0alpha1.ResourcePermissionspecResource {
	return v0alpha1.ResourcePermissionspecResource{
		ApiGroup: g.Group,
		Resource: g.Resource,
		Name:     g.Name,
	}
}

// ParseScope parses a scope string (e.g. folders:uid:1) into a groupResourceName (e.g. {folder.grafana.app, folders, fold1}).
// If the scope is a datasource scope, the datasourceType is used to resolve the concrete group.
func (s *ResourcePermSqlBackend) ParseScope(scope, datasourceType string) (*groupResourceName, error) {
	return s.mappers.ParseScope(scope, datasourceType)
}

// splitResourceName splits a resource name in the format <group>-<resource>-<name>
// (e.g. dashboard.grafana.app-dashboards-ad5rwqs) into its components.
//
// FIXME: strings.SplitN(name, "-", 3) mangles groups that contain hyphens
// (e.g. grafana-testdata-datasource.datasource.grafana.app). A delimiter-free
// encoding (e.g. base64-encoded group, or a different separator) is needed
// before datasource permissions can work with hyphenated plugin IDs.
func splitResourceName(resourceName string) (*groupResourceName, error) {
	// e.g. dashboard.grafana.app-dashboards-ad5rwqs
	parts := strings.SplitN(resourceName, "-", 3)
	if len(parts) != 3 {
		return nil, fmt.Errorf("%w: %s", errInvalidName, resourceName)
	}

	group, resourceType, uid := parts[0], parts[1], parts[2]

	return &groupResourceName{
		Group:    group,
		Resource: resourceType,
		Name:     uid,
	}, nil
}

// getResourceMapper returns the Mapper for the given group and resource.
func (s *ResourcePermSqlBackend) getResourceMapper(group, resource string) (Mapper, error) {
	mapper, ok := s.mappers.Get(schema.GroupResource{Group: group, Resource: resource})
	if !ok {
		return nil, fmt.Errorf("%w: %s/%s", errUnknownGroupResource, group, resource)
	}
	return mapper, nil
}

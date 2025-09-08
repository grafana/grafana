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

type IdentityStore interface {
	GetServiceAccountInternalID(ctx context.Context, ns types.NamespaceInfo, query idStore.GetServiceAccountInternalIDQuery) (*idStore.GetServiceAccountInternalIDResult, error)
	GetTeamInternalID(ctx context.Context, ns types.NamespaceInfo, query idStore.GetTeamInternalIDQuery) (*idStore.GetTeamInternalIDResult, error)
	GetUserInternalID(ctx context.Context, ns types.NamespaceInfo, query idStore.GetUserInternalIDQuery) (*idStore.GetUserInternalIDResult, error)
}

type ListResourcePermissionsQuery struct {
	Scopes     []string
	OrgID      int64
	ActionSets []string
	Pagination common.Pagination
}

type DeleteResourcePermissionsQuery struct {
	Scope string
	OrgID int64
}

type rbacAssignmentCreate struct {
	Action           string // e.g. "dashboards:edit"
	Scope            string // e.g. "folders:uid:1"
	RoleName         string // e.g. "managed:users:1:permissions
	SubjectID        any    // int64 for user/team, string for builtin_role
	AssignmentTable  string // "user_role", "team_role", or "builtin_role"
	AssignmentColumn string // "user_id", "team_id", or "role"
}

func (g *rbacAssignmentCreate) permission() accesscontrol.Permission {
	p := accesscontrol.Permission{
		Action: g.Action,
		Scope:  g.Scope,
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
}

// newV0ResourcePermission creates a new v0alpha1.ResourcePermission from the given groupResourceName and permission specs.
// Specs are sorted for consistency, created and updated are used for the metadata timestamps and resourceVersion is set to the updated timestamp in milliseconds.
func newV0ResourcePermission(grn *groupResourceName, specs []v0alpha1.ResourcePermissionspecPermission, created, updated time.Time) v0alpha1.ResourcePermission {
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
			ResourceVersion:   fmt.Sprint(updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(created.UTC()),
		},
		Spec: v0alpha1.ResourcePermissionSpec{
			Resource:    grn.v0alpha1(),
			Permissions: specs,
		},
	}
	r.SetUpdateTimestamp(updated.UTC())
	return r
}

// toV0ResourcePermissions translates a list of rbacAssignments into a list of v0alpha1.ResourcePermissions.
// it is assumed that assignments are sorted by scope
func (s *ResourcePermSqlBackend) toV0ResourcePermissions(assignments []rbacAssignment) ([]v0alpha1.ResourcePermission, error) {
	if len(assignments) == 0 {
		return nil, nil
	}

	var (
		created        = assignments[0].Created
		updated        = assignments[0].Updated
		permissionKind v0alpha1.ResourcePermissionSpecPermissionKind

		resourcePermissions = make([]v0alpha1.ResourcePermission, 0, 8)
		specs               = make([]v0alpha1.ResourcePermissionspecPermission, 0, 4)
	)

	grn, err := s.parseScope(assignments[0].Scope)
	if err != nil {
		return nil, err
	}

	for _, assign := range assignments {
		// Ensure all assignments belong to the same resource
		parsedGrn, err := s.parseScope(assign.Scope)
		if err != nil {
			return nil, err
		}
		// If it's a new resource, flush the current specs to a ResourcePermission and start a new one
		if *parsedGrn != *grn {
			resourcePermissions = append(
				resourcePermissions,
				newV0ResourcePermission(grn, specs, created, updated),
			)

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

	// Flush the final resource
	resourcePermissions = append(
		resourcePermissions,
		newV0ResourcePermission(grn, specs, created, updated),
	)

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

// parseScope parses a scope string (e.g. folders:uid:1) into a groupResourceName (e.g. {folder.grafana.app, folders, fold1}).
func (s *ResourcePermSqlBackend) parseScope(scope string) (*groupResourceName, error) {
	parts := strings.SplitN(scope, ":", 3)
	if len(parts) != 3 {
		return nil, fmt.Errorf("%w: %s", errInvalidScope, scope)
	}
	gr, ok := s.reverseMappers[parts[0]]
	if !ok {
		return nil, fmt.Errorf("%w: %s", errUnknownGroupResource, parts[0])
	}
	return &groupResourceName{
		Group:    gr.Group,
		Resource: gr.Resource,
		Name:     parts[2],
	}, nil
}

// splitResourceName splits a resource name in the format <group>-<resource>-<name> (e.g. dashboard.grafana.app-dashboards-ad5rwqs) into its components
func (s *ResourcePermSqlBackend) splitResourceName(resourceName string) (Mapper, *groupResourceName, error) {
	// e.g. dashboard.grafana.app-dashboards-ad5rwqs
	parts := strings.SplitN(resourceName, "-", 3)
	if len(parts) != 3 {
		return nil, nil, fmt.Errorf("%w: %s", errInvalidName, resourceName)
	}

	group, resourceType, uid := parts[0], parts[1], parts[2]
	mapper, ok := s.mappers[schema.GroupResource{Group: group, Resource: resourceType}]
	if !ok {
		return nil, nil, fmt.Errorf("%w: %s/%s", errUnknownGroupResource, group, resourceType)
	}

	return mapper, &groupResourceName{
		Group:    group,
		Resource: resourceType,
		Name:     uid,
	}, nil
}

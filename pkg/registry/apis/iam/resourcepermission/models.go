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
	Scope      string
	OrgID      int64
	ActionSets []string
	// TODO Pagination common.Pagination
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
	SubjectUID       string
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

// toV0ResourcePermissions converts rbacAssignment grouped by resource (e.g. {folder.grafana.app, folders, fold1}) to a list of v0alpha1.ResourcePermission
func toV0ResourcePermissions(permsByResource map[groupResourceName][]rbacAssignment) ([]v0alpha1.ResourcePermission, error) {
	if len(permsByResource) == 0 {
		return nil, nil
	}

	resourcePermissions := make([]v0alpha1.ResourcePermission, 0, len(permsByResource))
	for resource, perms := range permsByResource {
		specs := make([]v0alpha1.ResourcePermissionspecPermission, 0, len(perms))

		var (
			created        = time.Now()
			updated        = time.Now()
			permissionKind v0alpha1.ResourcePermissionSpecPermissionKind
		)
		for i := range perms {
			// Find the most recent updated time
			if i == 0 || perms[i].Updated.After(updated) {
				updated = perms[i].Updated
			}
			// Find the oldest created time
			if i == 0 || perms[i].Created.Before(created) {
				created = perms[i].Created
			}
			perm := perms[i]
			switch perm.SubjectType {
			case "user":
				if perm.IsServiceAccount {
					permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount
				} else {
					permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindUser
				}
			case "team":
				permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindTeam
			case "builtin_role":
				permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindBasicRole
			default:
				return nil, errors.New("unknown subject type: " + perm.SubjectType)
			}

			actionParts := strings.SplitN(perm.Action, ":", 2)
			if len(actionParts) < 2 || actionParts[1] == "" {
				return nil, fmt.Errorf("invalid action format: %s", perm.Action)
			}
			verb := actionParts[1]
			specs = append(specs, v0alpha1.ResourcePermissionspecPermission{
				Kind: permissionKind,
				Name: perm.SubjectUID,
				Verb: verb,
			})
		}

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
				Name:              resource.string(),
				ResourceVersion:   fmt.Sprint(updated.UnixMilli()),
				CreationTimestamp: metav1.NewTime(created.UTC()),
			},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource:    resource.v0alpha1(),
				Permissions: specs,
			},
		}
		r.SetUpdateTimestamp(updated.UTC())
		resourcePermissions = append(resourcePermissions, r)
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

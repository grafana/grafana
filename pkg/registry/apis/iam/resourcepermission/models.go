package resourcepermission

import (
	"errors"
	"fmt"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
)

var (
	errNotImplemented       = errors.New("not supported by this storage backend")
	errEmptyName            = errors.New("name cannot be empty")
	errUnknownGroupResource = errors.New("unknown group/resource")
	errNotFound             = errors.New("not found")
	errInvalidScope         = errors.New("invalid scope")
	errInvalidNamespace     = errors.New("invalid namespace")

	defaultLevels = []string{"view", "edit", "admin"}
)

type ListResourcePermissionsQuery struct {
	Scope      string
	OrgID      int64
	ActionSets []string
	Pagination common.Pagination
}

type flatResourcePermission struct {
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

func (s *ResourcePermSqlBackend) toV0ResourcePermissions(permsByResource map[groupResourceName][]flatResourcePermission) ([]v0alpha1.ResourcePermission, error) {
	if len(permsByResource) == 0 {
		return nil, nil
	}

	resourcePermissions := make([]v0alpha1.ResourcePermission, 0, len(permsByResource))
	for resource, perms := range permsByResource {
		specs := make([]v0alpha1.ResourcePermissionspecPermission, 0, len(perms))

		var (
			updated        = time.Now()
			permissionKind v0alpha1.ResourcePermissionSpecPermissionKind
		)
		for i := range perms {
			if i == 0 || perms[i].Updated.Before(updated) {
				updated = perms[i].Updated
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

			verb := strings.Split(perm.Action, ":")[1]
			specs = append(specs, v0alpha1.ResourcePermissionspecPermission{
				Kind: permissionKind,
				Name: perm.SubjectUID,
				Verb: verb,
			})
		}

		resourcePermissions = append(resourcePermissions, v0alpha1.ResourcePermission{
			TypeMeta: v0alpha1.ResourcePermissionInfo.TypeMeta(),
			ObjectMeta: metav1.ObjectMeta{
				Name:              resource.string(),
				ResourceVersion:   updated.Format(time.RFC3339),
				CreationTimestamp: metav1.NewTime(updated),
			},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource:    resource.v0alpha1(),
				Permissions: specs,
			},
		})
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

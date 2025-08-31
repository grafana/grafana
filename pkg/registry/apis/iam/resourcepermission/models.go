package resourcepermission

import (
	"fmt"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
)

var (
	errNotImplemented                = fmt.Errorf("not implemented")
	errEmptyName                     = fmt.Errorf("name cannot be empty")
	ErrDatabaseHelper                = fmt.Errorf("failed to get database")
	ErrResourcePermissionNotFound    = fmt.Errorf("resource permission not found")
	ErrEmptyResourcePermissionName   = fmt.Errorf("resource permission name cannot be empty")
	ErrNameMismatch                  = fmt.Errorf("name mismatch")
	ErrNamespaceMismatch             = fmt.Errorf("namespace mismatch")
	ErrInvalidResourcePermissionSpec = fmt.Errorf("invalid resource permission spec")
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

type distinctResource struct {
	Scope   string `xorm:"scope"`
	Created string `xorm:"created"`
}

func toV0ResourcePermission(permissionGroups map[string][]flatResourcePermission, name string) *v0alpha1.ResourcePermission {
	if len(permissionGroups) == 0 {
		return nil
	}

	var firstPerm flatResourcePermission
	var found bool
	for _, perms := range permissionGroups {
		if len(perms) > 0 {
			firstPerm = perms[0]
			found = true
			break
		}
	}

	if !found {
		return nil
	}

	var apiGroup, resourceType, resourceName string
	if firstPerm.Scope != "" {
		parts := strings.Split(firstPerm.Scope, ":")
		if len(parts) >= 1 {
			resourceType = parts[0]
			apiGroup = getApiGroupForResource(resourceType)
		}
		if len(parts) >= 3 {
			resourceName = parts[2]
		} else {
			resourceName = "*"
		}
	} else {
		apiGroup = "core.grafana.app"
		resourceType = "unknown"
		resourceName = "*"
	}

	permissions := make([]v0alpha1.ResourcePermissionspecPermission, 0, 1)

	for _, perms := range permissionGroups {
		if len(perms) == 0 {
			continue
		}

		first := perms[0]
		var permissionKind v0alpha1.ResourcePermissionSpecPermissionKind

		switch first.SubjectType {
		case "user":
			permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindUser
		case "team":
			permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindTeam
		case "builtin_role":
			permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindBasicRole
		default:
			permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindUser
		}

		if first.IsServiceAccount {
			permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount
		}

		verb := strings.Split(first.Action, ":")[1]
		permissions = append(permissions, v0alpha1.ResourcePermissionspecPermission{
			Kind: permissionKind,
			Name: first.SubjectUID,
			Verb: verb,
		})
	}

	return &v0alpha1.ResourcePermission{
		TypeMeta: v0alpha1.ResourcePermissionInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			ResourceVersion:   firstPerm.Updated.Format(time.RFC3339),
			CreationTimestamp: metav1.NewTime(firstPerm.Created),
		},
		Spec: v0alpha1.ResourcePermissionSpec{
			Resource: v0alpha1.ResourcePermissionspecResource{
				ApiGroup: apiGroup,
				Resource: resourceType,
				Name:     resourceName,
			},
			Permissions: permissions,
		},
	}
}

func getApiGroupForResource(resourceType string) string {
	switch resourceType {
	case "dashboards":
		return "dashboard.grafana.app"
	case "folders":
		return "folder.grafana.app"
	case "datasources":
		return "datasource.grafana.app"
	default:
		return "core.grafana.app"
	}
}

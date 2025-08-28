package resourcepermission

import (
	"fmt"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ resource.ListIterator = (*listIterator)(nil)

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
	Scope   string
	OrgID   int64
	Actions string

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

func toV0ResourcePermission(flatPerms []flatResourcePermission) *v0alpha1.ResourcePermission {
	if len(flatPerms) == 0 {
		return nil
	}

	first := flatPerms[0]

	var name string
	var permissionKind v0alpha1.ResourcePermissionSpecPermissionKind
	var permissionName string

	switch first.SubjectType {
	case "user":
		name = first.SubjectUID
		permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindUser
		permissionName = first.SubjectUID
	case "team":
		name = first.SubjectUID
		permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindTeam
		permissionName = first.SubjectUID
	case "builtin_role":
		name = first.SubjectUID
		permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindBasicRole
		permissionName = first.SubjectUID
	default:
		// Default case, shouldn't happen but handle gracefully
		name = "unknown"
		permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindUser
		permissionName = "unknown"
	}

	if first.IsServiceAccount {
		permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount
	}

	verbs := make([]string, 0, len(flatPerms))
	for _, perm := range flatPerms {
		verbs = append(verbs, perm.Action)
	}

	// Parse the scope to get resource information
	// Scope format is typically like "dashboards:*" or "dashboards:uid:abc123"
	var apiGroup, resourceType, resourceName string
	if len(flatPerms) > 0 && flatPerms[0].Scope != "" {
		parts := strings.Split(flatPerms[0].Scope, ":")
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

	return &v0alpha1.ResourcePermission{
		TypeMeta: v0alpha1.ResourcePermissionInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			ResourceVersion:   first.Updated.Format(time.RFC3339),
			CreationTimestamp: metav1.NewTime(first.Created),
		},
		Spec: v0alpha1.ResourcePermissionSpec{
			Resource: v0alpha1.ResourcePermissionspecResource{
				ApiGroup: apiGroup,
				Resource: resourceType,
				Name:     resourceName,
			},
			Permissions: []v0alpha1.ResourcePermissionspecPermission{
				{
					Kind:  permissionKind,
					Name:  permissionName,
					Verbs: verbs,
				},
			},
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

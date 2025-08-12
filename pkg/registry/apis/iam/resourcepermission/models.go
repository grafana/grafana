package resourcepermission

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ iam.ResourcePermissionStorageBackend = (*ResourcePermissionSqlBackend)(nil)
	_ resource.ListIterator                = (*listIterator)(nil)

	ErrDatabaseHelper                = fmt.Errorf("failed to get database")
	ErrResourcePermissionNotFound    = fmt.Errorf("resource permission not found")
	ErrEmptyResourcePermissionName   = fmt.Errorf("resource permission name cannot be empty")
	ErrNameMismatch                  = fmt.Errorf("name mismatch")
	ErrNamespaceMismatch             = fmt.Errorf("namespace mismatch")
	ErrInvalidResourcePermissionSpec = fmt.Errorf("invalid resource permission spec")
)

type ListResourcePermissionsQuery struct {
	UID     string
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
	SubjectUID       string    `xorm:"subject_uid"`
	SubjectType      string    `xorm:"subject_type"` // 'user', 'team', or 'builtin'
	IsServiceAccount bool      `xorm:"is_service_account"`
}

func toV0ResourcePermission(flatPerms []flatResourcePermission) *v0alpha1.ResourcePermission {
	if len(flatPerms) == 0 {
		return nil
	}

	// Use the first permission to get the basic info
	first := flatPerms[0]

	// Generate a unique identifier from the permission data
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
	default:
		// Default case, shouldn't happen but handle gracefully
		name = "unknown"
		permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindUser
		permissionName = "unknown"
	}

	// If we have service account, override the kind
	if first.IsServiceAccount {
		permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount
	}

	// Collect all verbs/actions
	verbs := make([]string, 0, len(flatPerms))
	for _, perm := range flatPerms {
		verbs = append(verbs, perm.Action)
	}

	// Parse the scope to get resource information
	// Scope format is typically like "dashboards:*" or "dashboards:uid:abc123"
	var apiGroup, resourceType, resourceName string
	// For now, we'll use placeholder values since the exact scope parsing
	// depends on the specific format used by Grafana
	apiGroup = "grafana.app"
	resourceType = "dashboards" // This would need to be parsed from scope
	resourceName = "*"          // This would need to be parsed from scope

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

package resourcepermission

import (
	"database/sql"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ iam.ResourcePermissionStorageBackend = (*ResourcePermissionSqlBackend)(nil)
	_ resource.ListIterator                = (*listIterator)(nil)
)

type ListResourcePermissionsQuery struct {
	UID string

	Pagination common.Pagination
}

type flatResourcePermission struct {
	ID               int64          `xorm:"id"`
	RoleName         string         `xorm:"role_name"`
	RoleUID          string         `xorm:"role_uid"`
	OrgID            int64          `xorm:"org_id"`
	Action           string         `xorm:"action"`
	Scope            string         `xorm:"scope"`
	Created          time.Time      `xorm:"created"`
	Updated          time.Time      `xorm:"updated"`
	UserID           sql.NullInt64  `xorm:"user_id"`
	UserOrgID        sql.NullInt64  `xorm:"user_org_id"`
	UserUID          sql.NullString `xorm:"user_uid"`
	UserLogin        sql.NullString `xorm:"user_login"`
	UserName         sql.NullString `xorm:"user_name"`
	UserEmail        sql.NullString `xorm:"user_email"`
	IsServiceAccount bool           `xorm:"is_service_account"`
	TeamID           sql.NullInt64  `xorm:"team_id"`
	TeamUID          sql.NullString `xorm:"team_uid"`
	TeamName         sql.NullString `xorm:"team_name"`
	BuiltInOrgID     sql.NullInt64  `xorm:"builtin_org_id"`
	BuiltInRole      sql.NullString `xorm:"builtin_role"`
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

	if first.UserID.Valid {
		name = first.UserUID.String
		permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindUser
		permissionName = first.UserUID.String
	} else if first.TeamID.Valid {
		name = first.TeamUID.String
		permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindTeam
		permissionName = first.TeamUID.String
	} else if first.BuiltInRole.Valid {
		name = first.BuiltInRole.String
		permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindBasicRole
		permissionName = first.BuiltInRole.String
	} else {
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

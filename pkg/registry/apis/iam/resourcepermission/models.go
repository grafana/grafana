package resourcepermission

import (
	"fmt"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"

	"github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Helper function to check if slice contains string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

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
	RoleName         string    `xorm:"role_name"`
}

// generateMeaningfulNameForManagedRole creates a readable name for managed roles
// based on the permissions they contain
func generateMeaningfulNameForManagedRole(flatPerms []flatResourcePermission) string {
	if len(flatPerms) == 0 {
		return "unknown-role"
	}

	// Analyze the actions to determine the permission level
	actions := make(map[string]bool)
	for _, perm := range flatPerms {
		actions[perm.Action] = true
	}

	// Determine permission level based on actions
	hasRead := actions["dashboards:read"]
	hasWrite := actions["dashboards:write"]
	hasDelete := actions["dashboards:delete"]
	hasPermissions := actions["dashboards.permissions:read"] || actions["dashboards.permissions:write"]

	if hasPermissions {
		return "dashboard-admin-role"
	} else if hasDelete && hasWrite && hasRead {
		return "dashboard-editor-role"
	} else if hasRead {
		return "dashboard-viewer-role"
	}

	// Fallback based on first action
	firstAction := flatPerms[0].Action
	if strings.Contains(firstAction, ":") {
		parts := strings.Split(firstAction, ":")
		if len(parts) >= 2 {
			return fmt.Sprintf("%s-%s-role", parts[0], parts[1])
		}
	}

	return "managed-role"
}

func toV0ResourcePermission(flatPerms []flatResourcePermission, namespace string) *v0alpha1.ResourcePermission {

	if len(flatPerms) == 0 {
		return nil
	}

	first := flatPerms[0]

	// For ResourcePermissions, the SubjectUID contains the ResourcePermission name
	if first.SubjectType != "resourcepermission" {
		return nil
	}

	// Use the ResourcePermission name directly
	// Use simple names like CoreRoles for authorization
	name := fmt.Sprintf("rp_%d", first.ID) // Simple name like "rp_123"

	// Collect all actions and organize by role patterns to determine permission subject and verbs
	actionsBySubject := make(map[string][]string)
	var allScopes []string

	for _, perm := range flatPerms {
		// Extract the verb level from role name (e.g., "managed:users:1:admin:permissions" -> "admin")
		roleParts := strings.Split(perm.RoleName, ":")
		var verbLevel string
		if len(roleParts) >= 4 {
			verbLevel = roleParts[3] // admin, edit, view
		} else {
			verbLevel = "unknown"
		}

		actionsBySubject[verbLevel] = append(actionsBySubject[verbLevel], perm.Action)
		if perm.Scope != "" && !contains(allScopes, perm.Scope) {
			allScopes = append(allScopes, perm.Scope)
		}
	}

	// Convert action groups back to high-level verbs
	verbs := make([]string, 0)
	if len(actionsBySubject["admin"]) > 0 {
		verbs = append(verbs, "admin")
	} else if len(actionsBySubject["editor"]) > 0 || len(actionsBySubject["edit"]) > 0 {
		verbs = append(verbs, "edit")
	} else if len(actionsBySubject["viewer"]) > 0 || len(actionsBySubject["view"]) > 0 {
		verbs = append(verbs, "view")
	}

	// If no high-level verbs found, use the actual actions as verbs
	if len(verbs) == 0 {
		for _, perm := range flatPerms {
			if !contains(verbs, perm.Action) {
				verbs = append(verbs, perm.Action)
			}
		}
	}

	// Determine the permission subject from the role name pattern
	// Role names like "managed:users:1:admin:permissions" indicate user permissions
	var permissionKind v0alpha1.ResourcePermissionSpecPermissionKind
	var permissionName string

	// Look at the first role to determine the subject type
	if len(flatPerms) > 0 {
		roleParts := strings.Split(flatPerms[0].RoleName, ":")
		if len(roleParts) >= 2 {
			subjectType := roleParts[1] // users, teams, builtin
			switch subjectType {
			case "users":
				permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindUser
				permissionName = "admin" // Default to admin for now - could extract from user assignments
			case "teams":
				permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindTeam
				permissionName = "default-team" // Could extract from team assignments
			case "builtin":
				permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindBasicRole
				permissionName = "Viewer" // Could extract from builtin role assignments
			default:
				permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindUser
				permissionName = "admin"
			}
		} else {
			permissionKind = v0alpha1.ResourcePermissionSpecPermissionKindUser
			permissionName = "admin"
		}
	}

	// Parse the scope to get resource information
	// Scope format is typically like "dashboards:uid:abc123"
	var apiGroup, resourceType, resourceName string

	// Parse the scope from the first permission to get resource details
	if len(flatPerms) > 0 && flatPerms[0].Scope != "" {
		scopeParts := strings.Split(flatPerms[0].Scope, ":")
		if len(scopeParts) >= 1 {
			resourceType = scopeParts[0] // e.g., "dashboards"
		}
		if len(scopeParts) >= 3 && scopeParts[1] == "uid" {
			resourceName = scopeParts[2] // e.g., "test-dash-final"
		} else if len(scopeParts) >= 2 {
			resourceName = scopeParts[1] // e.g., "*" or direct name
		} else {
			resourceName = "*"
		}
	} else {
		resourceType = "dashboards" // fallback
		resourceName = "*"          // fallback
	}

	// Set the appropriate API group based on resource type
	switch resourceType {
	case "dashboards":
		apiGroup = "dashboard.grafana.app"
	case "folders":
		apiGroup = "folder.grafana.app"
	case "datasources":
		apiGroup = "datasource.grafana.app"
	default:
		apiGroup = "grafana.app"
	}

	// Add annotations to show the relationship
	annotations := make(map[string]string)
	if first.SubjectType == "resourcepermission" {
		annotations["resourcepermission.iam.grafana.app/parent"] = first.SubjectUID
	}

	result := &v0alpha1.ResourcePermission{
		TypeMeta: v0alpha1.ResourcePermissionInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			Namespace:         namespace,
			ResourceVersion:   first.Updated.Format(time.RFC3339),
			CreationTimestamp: metav1.NewTime(first.Created),
			Annotations:       annotations,
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

	return result
}

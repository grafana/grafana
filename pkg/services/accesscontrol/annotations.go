package accesscontrol

const (
	// RoleNameAnnotation is the annotation key for the legacy role name on a GlobalRole.
	RoleNameAnnotation = "iam.grafana.app/role-name"
	// RoleHiddenAnnotation is the annotation key indicating a hidden role.
	RoleHiddenAnnotation = "iam.grafana.app/hidden"

	// LegacyGlobalRoleAnnotation marks a namespaced Role projected from a legacy
	// global custom role. It preserves legacy API presentation during migration;
	// it does not grant global authorization or affect storage routing.
	LegacyGlobalRoleAnnotation = "iam.grafana.app/internal-legacy-global"
)

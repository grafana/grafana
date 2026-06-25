package ossaccesscontrol

// Display names shared by the generated reader/writer permission-management
// roles (fixed:{resource}.permissions:reader and :writer) for resources that use
// the default naming.
const (
	permissionReaderRoleName = "Permission reader"
	permissionWriterRoleName = "Permission writer"
)

// Resource identity values shared between the resourcepermissions service
// constructors (Provide*) and the fixed-role reconstruction consumed by the
// GlobalRole seeder (*PermissionsRoleRegistrations). Both call sites must use
// these constants so the generated role names cannot drift apart.
const (
	folderPermissionsResource  = "folders"
	folderPermissionsRoleGroup = "Folders"

	dashboardPermissionsResource  = "dashboards"
	dashboardPermissionsRoleGroup = "Dashboards"

	teamPermissionsResource  = "teams"
	teamPermissionsRoleGroup = "Teams"

	serviceAccountPermissionsResource  = "serviceaccounts"
	serviceAccountPermissionsAPIGroup  = "iam.grafana.app"
	serviceAccountPermissionsRoleGroup = "Service accounts"

	receiverPermissionsResource       = "receivers"
	receiverPermissionsReaderRoleName = "Alerting receiver permission reader"
	receiverPermissionsWriterRoleName = "Alerting receiver permission writer"

	routePermissionsReaderRoleName = "Alerting route permission reader"
	routePermissionsWriterRoleName = "Alerting route permission writer"
)

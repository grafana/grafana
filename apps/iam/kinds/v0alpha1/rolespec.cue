package v0alpha1

RoleSpec: {
	#Permission: {
		// RBAC action (e.g: "dashbaords:read")
		action: string
		// RBAC scope (e.g: "dashboards:uid:dash1")
		scope: string
	}

	// Display name of the role
	title: string
	description: string

	version: int
	group: string

	// Permissions for custom roles
	permissions: [...#Permission]

	// Permissions that exist in actual role but NOT in seed (added/excess permissions) - used for basic roles
	permissionsAdded?: [...#Permission]

	// Permissions that exist in seed but NOT in actual role (missing/omitted permissions) - used for basic roles
	permissionsOmitted?: [...#Permission]

	// TODO:
	// delegatable?: bool
	// created?
	// updated?
}

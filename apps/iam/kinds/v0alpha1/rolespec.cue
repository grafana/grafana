package v0alpha1

RoleSpec: {
	#Permission: {
		// RBAC action (e.g: "dashbaords:read")
		action: string
		// RBAC scope (e.g: "dashboards:uid:dash1")
		scope: string
	}

	#RoleRef: {
		// Kind of role being referenced (for now only GlobalRole is supported)
		kind: string
		// Name of the role being referenced
		name: string
	}

	// Display name of the role
	title: string
	description: string
	group: string

	// Added permissions (permissions in actual role but NOT in seed) - for basic roles only. For custom roles, this contains all permissions.
	permissions?: [...#Permission]

	// Permissions that exist in seed but NOT in actual role (missing/omitted permissions) - used for basic roles only
	permissionsOmitted?: [...#Permission]

	// Roles to take permissions from (for now the list should be of size 1)
	roleRefs?: [...#RoleRef]

	// TODO:
	// delegatable?: bool
	// created?
	// updated?
}

package v0alpha1

GlobalRoleSpec: {
	#Permission: {
		// RBAC action (e.g: "dashbaords:read")
		action: string
		// RBAC scope (e.g: "dashboards:uid:dash1")
		scope: string
	}

	// Display name of the role
	title:       string
	description: string
	group:       string

	// Permissions for this role
	permissions?: [...#Permission]
}

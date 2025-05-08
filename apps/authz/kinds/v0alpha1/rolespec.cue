package v0alpha1

RoleSpec: {
	#Permission: {
		// RBAC action (e.g: "dashbaords:read")
		action: string
		// RBAC scope (e.g: "dashboards:uid:dash1")
		scope: string
	}
	
	name: string
	displayName: string
	uid: string
	version: int
	group: string
	permissions: [...#Permission]

	// TODO:
	// delegatable?: bool
	// created?
	// updated?
}


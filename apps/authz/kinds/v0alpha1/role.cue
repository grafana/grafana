package v0alpha1

Role: {
	#Permission: {
		// RBAC action (e.g: "dashbaords:read")
		action: string
		// RBAC scope (e.g: "dashboards:uid:dash1")
		Scope: string
	}
	
	name: string
	displayName: string
	uid: string
	version: int
	group: string
	// delegatable?: bool
	// hidden?: bool
	permissions: [...#Permission]
	// created?
	// updated?
}


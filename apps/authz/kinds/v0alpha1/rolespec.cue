package v0alpha1

RoleSpec: {
	#Permission: {
		// RBAC action (e.g: "dashbaords:read")
		action: string
		// RBAC scope (e.g: "dashboards:uid:dash1")
		scope: string
	}
	
	name: string
	// Display name of the role
	title: string
	// ToDo should we remove UID given it should be the k8s resource name?
	uid: string
	version: int
	group: string
	permissions: [...#Permission]

	// TODO:
	// delegatable?: bool
	// created?
	// updated?
}


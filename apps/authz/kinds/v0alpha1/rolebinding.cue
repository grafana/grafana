package v0alpha1

RoleBinding: {
	#Subject: {
		// kind of the identity getting the permission
		kind: "User" | "ServiceAccount" | "Team" | "BasicRole"
		// uid of the resource (e.g: "fold1")
		name: string
	}
	#RoleRef: {
		// kind of role
		kind: Role
		// uid of the role
		name: string
	}

	// TODO: 
	// includeHidden
	// global

	subjects: [...#Subject]
	roleRef: #RoleRef
}


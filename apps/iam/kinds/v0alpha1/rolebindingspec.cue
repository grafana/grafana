package v0alpha1

RoleBindingSpec: {
	#Subject: {
		// kind of the identity getting the permission
		kind: "User" | "ServiceAccount" | "Team" | "BasicRole"
		// uid of the identity
		name: string
	}
	#RoleRef: {
		// kind of role
		kind: "Role" | "CoreRole" | "GlobalRole"
		// uid of the role
		name: string
	}

	subjects: [...#Subject]
	roleRef: #RoleRef
}

GlobalRoleBindingSpec: {
	#Subject: {
		// kind of the identity getting the permission
		kind: "User" | "ServiceAccount" | "Team" | "BasicRole"
		// uid of the identity
		name: string
	}
	#RoleRef: {
		// kind of role
		kind: "CoreRole" | "GlobalRole"
		// uid of the role
		name: string
	}

	subjects: [...#Subject]
	roleRef: #RoleRef
}

package v0alpha1

RoleBindingSpec: {
	#Subject: {
		// kind of the identity getting the permission
		kind: "User" | "ServiceAccount" | "Team"
		// uid of the identity
		name: string
	}
	#RoleRef: {
		// kind of role
		kind: "Role" | "GlobalRole"
		// uid of the role
		name: string
	}

	subject: #Subject
	roleRefs: [...#RoleRef]
}

GlobalRoleBindingSpec: {
	#Subject: {
		// kind of the identity getting the permission
		kind: "User" | "ServiceAccount" | "Team"
		// uid of the identity
		name: string
	}
	#RoleRef: {
		// kind of role
		kind: "GlobalRole"
		// uid of the role
		name: string
	}

	subject: #Subject
	roleRefs: [...#RoleRef]
}

package v0alpha1

TeamBindingSpec: {
	#Subject: TeamPermissionSpec
	#TeamRef: {
		// uid of the Team
		name: string
	}

	subjects: [...#Subject]
	teamRef: #TeamRef
}

TeamPermissionSpec: {
    name: string

    permission: TeamPermission
}

TeamPermission: "admin" | "member"

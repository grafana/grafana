package v0alpha1

TeamBindingSpec: {
	#Subject: {
		// kind of the identity
		kind: "User"
		// uid of the identity
		name: string
	}

	subject: #Subject
	teamRef: TeamRef

	// permission of the identity in the team
	permission: TeamPermission

	external: bool
}

TeamRef: {
	// Name is the unique identifier for a team.
	name: string
}

TeamPermission: "admin" | "member"

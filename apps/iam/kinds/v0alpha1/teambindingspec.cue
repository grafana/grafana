package v0alpha1

TeamBindingSpec: {
	#Subject: {
		// uid of the identity
		name: string
		// permission of the identity in the team
		permission: TeamPermission
	}

	subjects: [...#Subject]
	teamRef: TeamRef
}

TeamRef:{
	// Name is the unique identifier for a team.
	name: string
}

TeamPermission: "admin" | "member"

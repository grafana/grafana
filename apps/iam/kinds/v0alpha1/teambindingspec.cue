package v0alpha1

TeamBindingSpec: {
	#Subject: {
		// uid of the identity
		name: string
		// permission of the identity in the team
		permission: TeamPermission
	}
	
	#TeamRef: {
		// uid of the Team
		name: string
	}

	subjects: [...#Subject]
	teamRef: #TeamRef
}

TeamPermission: "admin" | "member"

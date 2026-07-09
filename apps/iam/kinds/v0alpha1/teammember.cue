package v0alpha1

TeamMember: {
	// kind of the identity
	kind: "User"
	// uid of the identity
	name: string
	// permission of the identity in the team
	permission: TeamPermission
	// whether the member was added externally (e.g. team sync)
	external: bool
}

TeamPermission: "admin" | "member"

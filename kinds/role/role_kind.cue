spec: {
	// The role identifier `managed:builtins:editor:permissions`
	name: string
	// Optional display
	displayName?: string
	// Name of the team.
	groupName?: string
	// Role description
	description?: string

	// Do not show this role
	hidden: bool | false
} @cuetsy(kind="interface")

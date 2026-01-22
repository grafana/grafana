package v0alpha1

TeamLBACRuleSpec: {
	// Data source UID that this TeamLBAC Rule applies to
	datasource_uid: string
	// Data source type that this TeamLBAC Rule applies to
	datasource_type: string
	// Team UID that this TeamLBAC Rule applies to
	team_uid: string
	// Filters for the TeamLBAC Rule
	filters: [...string]
}

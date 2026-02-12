package v0alpha1

TeamLBACRuleSpec: {
	// Data source UID that this TeamLBAC Rule applies to
	datasource_uid: string
	// Data source type that this TeamLBAC Rule applies to
	datasource_type: string
	// Map of team UIDs to their filter lists
	// Each team can have multiple filters
	team_filters: [string]: [...string]
}

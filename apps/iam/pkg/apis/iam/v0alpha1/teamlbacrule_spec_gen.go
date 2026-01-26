// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type TeamLBACRuleSpec struct {
	// Data source UID that this TeamLBAC Rule applies to
	DatasourceUid string `json:"datasource_uid"`
	// Data source type that this TeamLBAC Rule applies to
	DatasourceType string `json:"datasource_type"`
	// Map of team UIDs to their filter lists
	// Each team can have multiple filters
	TeamFilters map[string][]string `json:"team_filters"`
}

// NewTeamLBACRuleSpec creates a new TeamLBACRuleSpec object.
func NewTeamLBACRuleSpec() *TeamLBACRuleSpec {
	return &TeamLBACRuleSpec{
		TeamFilters: map[string][]string{},
	}
}

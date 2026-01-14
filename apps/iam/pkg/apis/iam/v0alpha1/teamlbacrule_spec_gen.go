// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type TeamLBACRuleSpec struct {
	// Data source UID that this TeamLBAC Rule applies to
	DatasourceUid string `json:"datasource_uid"`
	// Team UID that this TeamLBAC Rule applies to
	TeamUid string `json:"team_uid"`
	// Filters for the TeamLBAC Rule
	Filter []string `json:"filter"`
}

// NewTeamLBACRuleSpec creates a new TeamLBACRuleSpec object.
func NewTeamLBACRuleSpec() *TeamLBACRuleSpec {
	return &TeamLBACRuleSpec{
		Filter: []string{},
	}
}

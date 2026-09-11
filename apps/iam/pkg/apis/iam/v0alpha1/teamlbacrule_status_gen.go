// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// Condition is a minimal Kubernetes-style condition for dynamically computed
// Team LBAC status.
// +k8s:openapi-gen=true
type TeamLBACRuleCondition struct {
	// type identifies the condition. Enforceable is the only type currently
	// defined for TeamLBACRule.
	Type string `json:"type"`
	// status is True when the rule is enforceable, False when it is dormant,
	// and Unknown when enforceability could not be determined.
	Status TeamLBACRuleConditionStatus `json:"status"`
	// reason is a stable, machine-readable explanation for the current status.
	// It is intentionally open-ended so clients tolerate reasons added later.
	Reason string `json:"reason"`
}

// NewTeamLBACRuleCondition creates a new TeamLBACRuleCondition object.
func NewTeamLBACRuleCondition() *TeamLBACRuleCondition {
	return &TeamLBACRuleCondition{}
}

// OpenAPIModelName returns the OpenAPI model name for TeamLBACRuleCondition.
func (TeamLBACRuleCondition) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.TeamLBACRuleCondition"
}

// +k8s:openapi-gen=true
type TeamLBACRuleStatus struct {
	// conditions contains system-owned observations about the rule. The
	// Enforceable condition is the only condition currently defined.
	// +listType=map
	// +listMapKey=type
	Conditions []TeamLBACRuleCondition `json:"conditions,omitempty"`
}

// NewTeamLBACRuleStatus creates a new TeamLBACRuleStatus object.
func NewTeamLBACRuleStatus() *TeamLBACRuleStatus {
	return &TeamLBACRuleStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for TeamLBACRuleStatus.
func (TeamLBACRuleStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.TeamLBACRuleStatus"
}

// +k8s:openapi-gen=true
type TeamLBACRuleConditionStatus string

const (
	TeamLBACRuleConditionStatusTrue    TeamLBACRuleConditionStatus = "True"
	TeamLBACRuleConditionStatusFalse   TeamLBACRuleConditionStatus = "False"
	TeamLBACRuleConditionStatusUnknown TeamLBACRuleConditionStatus = "Unknown"
)

// OpenAPIModelName returns the OpenAPI model name for TeamLBACRuleConditionStatus.
func (TeamLBACRuleConditionStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.TeamLBACRuleConditionStatus"
}

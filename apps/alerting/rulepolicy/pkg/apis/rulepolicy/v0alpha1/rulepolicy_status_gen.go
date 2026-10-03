// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RulePolicystatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State RulePolicyStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewRulePolicystatusOperatorState creates a new RulePolicystatusOperatorState object.
func NewRulePolicystatusOperatorState() *RulePolicystatusOperatorState {
	return &RulePolicystatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for RulePolicystatusOperatorState.
func (RulePolicystatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rulepolicy.pkg.apis.rulepolicy.v0alpha1.RulePolicystatusOperatorState"
}

// +k8s:openapi-gen=true
type RulePolicyStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]RulePolicystatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewRulePolicyStatus creates a new RulePolicyStatus object.
func NewRulePolicyStatus() *RulePolicyStatus {
	return &RulePolicyStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for RulePolicyStatus.
func (RulePolicyStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rulepolicy.pkg.apis.rulepolicy.v0alpha1.RulePolicyStatus"
}

// +k8s:openapi-gen=true
type RulePolicyStatusOperatorStateState string

const (
	RulePolicyStatusOperatorStateStateSuccess    RulePolicyStatusOperatorStateState = "success"
	RulePolicyStatusOperatorStateStateInProgress RulePolicyStatusOperatorStateState = "in_progress"
	RulePolicyStatusOperatorStateStateFailed     RulePolicyStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for RulePolicyStatusOperatorStateState.
func (RulePolicyStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rulepolicy.pkg.apis.rulepolicy.v0alpha1.RulePolicyStatusOperatorStateState"
}

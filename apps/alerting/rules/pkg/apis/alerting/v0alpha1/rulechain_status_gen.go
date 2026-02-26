// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RuleChainstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State RuleChainStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewRuleChainstatusOperatorState creates a new RuleChainstatusOperatorState object.
func NewRuleChainstatusOperatorState() *RuleChainstatusOperatorState {
	return &RuleChainstatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for RuleChainstatusOperatorState.
func (RuleChainstatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RuleChainstatusOperatorState"
}

// +k8s:openapi-gen=true
type RuleChainStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]RuleChainstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewRuleChainStatus creates a new RuleChainStatus object.
func NewRuleChainStatus() *RuleChainStatus {
	return &RuleChainStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for RuleChainStatus.
func (RuleChainStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RuleChainStatus"
}

// +k8s:openapi-gen=true
type RuleChainStatusOperatorStateState string

const (
	RuleChainStatusOperatorStateStateSuccess    RuleChainStatusOperatorStateState = "success"
	RuleChainStatusOperatorStateStateInProgress RuleChainStatusOperatorStateState = "in_progress"
	RuleChainStatusOperatorStateStateFailed     RuleChainStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for RuleChainStatusOperatorStateState.
func (RuleChainStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RuleChainStatusOperatorStateState"
}

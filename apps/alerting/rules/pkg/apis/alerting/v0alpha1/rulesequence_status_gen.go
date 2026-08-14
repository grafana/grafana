// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RuleSequencestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State RuleSequenceStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewRuleSequencestatusOperatorState creates a new RuleSequencestatusOperatorState object.
func NewRuleSequencestatusOperatorState() *RuleSequencestatusOperatorState {
	return &RuleSequencestatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for RuleSequencestatusOperatorState.
func (RuleSequencestatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RuleSequencestatusOperatorState"
}

// +k8s:openapi-gen=true
type RuleSequenceStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]RuleSequencestatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewRuleSequenceStatus creates a new RuleSequenceStatus object.
func NewRuleSequenceStatus() *RuleSequenceStatus {
	return &RuleSequenceStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for RuleSequenceStatus.
func (RuleSequenceStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RuleSequenceStatus"
}

// +k8s:openapi-gen=true
type RuleSequenceStatusOperatorStateState string

const (
	RuleSequenceStatusOperatorStateStateSuccess    RuleSequenceStatusOperatorStateState = "success"
	RuleSequenceStatusOperatorStateStateInProgress RuleSequenceStatusOperatorStateState = "in_progress"
	RuleSequenceStatusOperatorStateStateFailed     RuleSequenceStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for RuleSequenceStatusOperatorStateState.
func (RuleSequenceStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RuleSequenceStatusOperatorStateState"
}

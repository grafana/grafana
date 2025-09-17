// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AlertRulestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State AlertRuleStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewAlertRulestatusOperatorState creates a new AlertRulestatusOperatorState object.
func NewAlertRulestatusOperatorState() *AlertRulestatusOperatorState {
	return &AlertRulestatusOperatorState{}
}

// +k8s:openapi-gen=true
type AlertRuleStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]AlertRulestatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewAlertRuleStatus creates a new AlertRuleStatus object.
func NewAlertRuleStatus() *AlertRuleStatus {
	return &AlertRuleStatus{}
}

// +k8s:openapi-gen=true
type AlertRuleStatusOperatorStateState string

const (
	AlertRuleStatusOperatorStateStateSuccess    AlertRuleStatusOperatorStateState = "success"
	AlertRuleStatusOperatorStateStateInProgress AlertRuleStatusOperatorStateState = "in_progress"
	AlertRuleStatusOperatorStateStateFailed     AlertRuleStatusOperatorStateState = "failed"
)

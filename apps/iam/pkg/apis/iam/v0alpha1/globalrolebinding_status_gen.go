// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GlobalRoleBindingstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State GlobalRoleBindingStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewGlobalRoleBindingstatusOperatorState creates a new GlobalRoleBindingstatusOperatorState object.
func NewGlobalRoleBindingstatusOperatorState() *GlobalRoleBindingstatusOperatorState {
	return &GlobalRoleBindingstatusOperatorState{}
}

// +k8s:openapi-gen=true
type GlobalRoleBindingStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]GlobalRoleBindingstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewGlobalRoleBindingStatus creates a new GlobalRoleBindingStatus object.
func NewGlobalRoleBindingStatus() *GlobalRoleBindingStatus {
	return &GlobalRoleBindingStatus{}
}

// +k8s:openapi-gen=true
type GlobalRoleBindingStatusOperatorStateState string

const (
	GlobalRoleBindingStatusOperatorStateStateSuccess    GlobalRoleBindingStatusOperatorStateState = "success"
	GlobalRoleBindingStatusOperatorStateStateInProgress GlobalRoleBindingStatusOperatorStateState = "in_progress"
	GlobalRoleBindingStatusOperatorStateStateFailed     GlobalRoleBindingStatusOperatorStateState = "failed"
)

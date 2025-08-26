// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GlobalRolestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State GlobalRoleStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewGlobalRolestatusOperatorState creates a new GlobalRolestatusOperatorState object.
func NewGlobalRolestatusOperatorState() *GlobalRolestatusOperatorState {
	return &GlobalRolestatusOperatorState{}
}

// +k8s:openapi-gen=true
type GlobalRoleStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]GlobalRolestatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewGlobalRoleStatus creates a new GlobalRoleStatus object.
func NewGlobalRoleStatus() *GlobalRoleStatus {
	return &GlobalRoleStatus{}
}

// +k8s:openapi-gen=true
type GlobalRoleStatusOperatorStateState string

const (
	GlobalRoleStatusOperatorStateStateSuccess    GlobalRoleStatusOperatorStateState = "success"
	GlobalRoleStatusOperatorStateStateInProgress GlobalRoleStatusOperatorStateState = "in_progress"
	GlobalRoleStatusOperatorStateStateFailed     GlobalRoleStatusOperatorStateState = "failed"
)

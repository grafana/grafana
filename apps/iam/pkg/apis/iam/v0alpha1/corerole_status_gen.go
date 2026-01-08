// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CoreRolestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State CoreRoleStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewCoreRolestatusOperatorState creates a new CoreRolestatusOperatorState object.
func NewCoreRolestatusOperatorState() *CoreRolestatusOperatorState {
	return &CoreRolestatusOperatorState{}
}

// +k8s:openapi-gen=true
type CoreRoleStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]CoreRolestatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewCoreRoleStatus creates a new CoreRoleStatus object.
func NewCoreRoleStatus() *CoreRoleStatus {
	return &CoreRoleStatus{}
}

// +k8s:openapi-gen=true
type CoreRoleStatusOperatorStateState string

const (
	CoreRoleStatusOperatorStateStateSuccess    CoreRoleStatusOperatorStateState = "success"
	CoreRoleStatusOperatorStateStateInProgress CoreRoleStatusOperatorStateState = "in_progress"
	CoreRoleStatusOperatorStateStateFailed     CoreRoleStatusOperatorStateState = "failed"
)

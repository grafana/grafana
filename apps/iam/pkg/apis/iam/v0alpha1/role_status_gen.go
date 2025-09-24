// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RolestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State RoleStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewRolestatusOperatorState creates a new RolestatusOperatorState object.
func NewRolestatusOperatorState() *RolestatusOperatorState {
	return &RolestatusOperatorState{}
}

// +k8s:openapi-gen=true
type RoleStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]RolestatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewRoleStatus creates a new RoleStatus object.
func NewRoleStatus() *RoleStatus {
	return &RoleStatus{}
}

// +k8s:openapi-gen=true
type RoleStatusOperatorStateState string

const (
	RoleStatusOperatorStateStateSuccess    RoleStatusOperatorStateState = "success"
	RoleStatusOperatorStateStateInProgress RoleStatusOperatorStateState = "in_progress"
	RoleStatusOperatorStateStateFailed     RoleStatusOperatorStateState = "failed"
)

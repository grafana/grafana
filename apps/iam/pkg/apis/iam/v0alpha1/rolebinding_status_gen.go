// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RoleBindingstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State RoleBindingStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewRoleBindingstatusOperatorState creates a new RoleBindingstatusOperatorState object.
func NewRoleBindingstatusOperatorState() *RoleBindingstatusOperatorState {
	return &RoleBindingstatusOperatorState{}
}

// +k8s:openapi-gen=true
type RoleBindingStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]RoleBindingstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewRoleBindingStatus creates a new RoleBindingStatus object.
func NewRoleBindingStatus() *RoleBindingStatus {
	return &RoleBindingStatus{}
}

// +k8s:openapi-gen=true
type RoleBindingStatusOperatorStateState string

const (
	RoleBindingStatusOperatorStateStateSuccess    RoleBindingStatusOperatorStateState = "success"
	RoleBindingStatusOperatorStateStateInProgress RoleBindingStatusOperatorStateState = "in_progress"
	RoleBindingStatusOperatorStateStateFailed     RoleBindingStatusOperatorStateState = "failed"
)

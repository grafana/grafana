// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type UserTeamstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State UserTeamStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewUserTeamstatusOperatorState creates a new UserTeamstatusOperatorState object.
func NewUserTeamstatusOperatorState() *UserTeamstatusOperatorState {
	return &UserTeamstatusOperatorState{}
}

// +k8s:openapi-gen=true
type UserTeamStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]UserTeamstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewUserTeamStatus creates a new UserTeamStatus object.
func NewUserTeamStatus() *UserTeamStatus {
	return &UserTeamStatus{}
}

// +k8s:openapi-gen=true
type UserTeamStatusOperatorStateState string

const (
	UserTeamStatusOperatorStateStateSuccess    UserTeamStatusOperatorStateState = "success"
	UserTeamStatusOperatorStateStateInProgress UserTeamStatusOperatorStateState = "in_progress"
	UserTeamStatusOperatorStateStateFailed     UserTeamStatusOperatorStateState = "failed"
)

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type UserstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State UserStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewUserstatusOperatorState creates a new UserstatusOperatorState object.
func NewUserstatusOperatorState() *UserstatusOperatorState {
	return &UserstatusOperatorState{}
}

// +k8s:openapi-gen=true
type UserStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]UserstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewUserStatus creates a new UserStatus object.
func NewUserStatus() *UserStatus {
	return &UserStatus{}
}

// +k8s:openapi-gen=true
type UserStatusOperatorStateState string

const (
	UserStatusOperatorStateStateSuccess    UserStatusOperatorStateState = "success"
	UserStatusOperatorStateStateInProgress UserStatusOperatorStateState = "in_progress"
	UserStatusOperatorStateStateFailed     UserStatusOperatorStateState = "failed"
)

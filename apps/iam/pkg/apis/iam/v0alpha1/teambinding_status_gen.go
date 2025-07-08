// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type TeamBindingstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State TeamBindingStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewTeamBindingstatusOperatorState creates a new TeamBindingstatusOperatorState object.
func NewTeamBindingstatusOperatorState() *TeamBindingstatusOperatorState {
	return &TeamBindingstatusOperatorState{}
}

// +k8s:openapi-gen=true
type TeamBindingStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]TeamBindingstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewTeamBindingStatus creates a new TeamBindingStatus object.
func NewTeamBindingStatus() *TeamBindingStatus {
	return &TeamBindingStatus{}
}

// +k8s:openapi-gen=true
type TeamBindingStatusOperatorStateState string

const (
	TeamBindingStatusOperatorStateStateSuccess    TeamBindingStatusOperatorStateState = "success"
	TeamBindingStatusOperatorStateStateInProgress TeamBindingStatusOperatorStateState = "in_progress"
	TeamBindingStatusOperatorStateStateFailed     TeamBindingStatusOperatorStateState = "failed"
)

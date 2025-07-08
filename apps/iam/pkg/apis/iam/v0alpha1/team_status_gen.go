// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type TeamstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State TeamStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewTeamstatusOperatorState creates a new TeamstatusOperatorState object.
func NewTeamstatusOperatorState() *TeamstatusOperatorState {
	return &TeamstatusOperatorState{}
}

// +k8s:openapi-gen=true
type TeamStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]TeamstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewTeamStatus creates a new TeamStatus object.
func NewTeamStatus() *TeamStatus {
	return &TeamStatus{}
}

// +k8s:openapi-gen=true
type TeamStatusOperatorStateState string

const (
	TeamStatusOperatorStateStateSuccess    TeamStatusOperatorStateState = "success"
	TeamStatusOperatorStateStateInProgress TeamStatusOperatorStateState = "in_progress"
	TeamStatusOperatorStateStateFailed     TeamStatusOperatorStateState = "failed"
)

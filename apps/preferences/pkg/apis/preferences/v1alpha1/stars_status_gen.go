// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type StarsstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State StarsStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewStarsstatusOperatorState creates a new StarsstatusOperatorState object.
func NewStarsstatusOperatorState() *StarsstatusOperatorState {
	return &StarsstatusOperatorState{}
}

// +k8s:openapi-gen=true
type StarsStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]StarsstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewStarsStatus creates a new StarsStatus object.
func NewStarsStatus() *StarsStatus {
	return &StarsStatus{}
}

// +k8s:openapi-gen=true
type StarsStatusOperatorStateState string

const (
	StarsStatusOperatorStateStateSuccess    StarsStatusOperatorStateState = "success"
	StarsStatusOperatorStateStateInProgress StarsStatusOperatorStateState = "in_progress"
	StarsStatusOperatorStateStateFailed     StarsStatusOperatorStateState = "failed"
)

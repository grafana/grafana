// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type DummystatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State DummyStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewDummystatusOperatorState creates a new DummystatusOperatorState object.
func NewDummystatusOperatorState() *DummystatusOperatorState {
	return &DummystatusOperatorState{}
}

// +k8s:openapi-gen=true
type DummyStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]DummystatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewDummyStatus creates a new DummyStatus object.
func NewDummyStatus() *DummyStatus {
	return &DummyStatus{}
}

// +k8s:openapi-gen=true
type DummyStatusOperatorStateState string

const (
	DummyStatusOperatorStateStateSuccess    DummyStatusOperatorStateState = "success"
	DummyStatusOperatorStateStateInProgress DummyStatusOperatorStateState = "in_progress"
	DummyStatusOperatorStateStateFailed     DummyStatusOperatorStateState = "failed"
)

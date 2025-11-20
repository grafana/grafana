// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ExamplestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ExampleStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewExamplestatusOperatorState creates a new ExamplestatusOperatorState object.
func NewExamplestatusOperatorState() *ExamplestatusOperatorState {
	return &ExamplestatusOperatorState{}
}

// +k8s:openapi-gen=true
type ExampleStatus struct {
	LastObservedGeneration int64 `json:"lastObservedGeneration"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]ExamplestatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewExampleStatus creates a new ExampleStatus object.
func NewExampleStatus() *ExampleStatus {
	return &ExampleStatus{}
}

// +k8s:openapi-gen=true
type ExampleStatusOperatorStateState string

const (
	ExampleStatusOperatorStateStateSuccess    ExampleStatusOperatorStateState = "success"
	ExampleStatusOperatorStateStateInProgress ExampleStatusOperatorStateState = "in_progress"
	ExampleStatusOperatorStateStateFailed     ExampleStatusOperatorStateState = "failed"
)

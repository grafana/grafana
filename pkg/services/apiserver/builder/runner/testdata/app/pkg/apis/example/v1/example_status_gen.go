package v1

// Defines values for ExampleOperatorStateState.
const (
	ExampleOperatorStateStateFailed     ExampleOperatorStateState = "failed"
	ExampleOperatorStateStateInProgress ExampleOperatorStateState = "in_progress"
	ExampleOperatorStateStateSuccess    ExampleOperatorStateState = "success"
)

// Defines values for ExamplestatusOperatorStateState.
const (
	ExamplestatusOperatorStateStateFailed     ExamplestatusOperatorStateState = "failed"
	ExamplestatusOperatorStateStateInProgress ExamplestatusOperatorStateState = "in_progress"
	ExamplestatusOperatorStateStateSuccess    ExamplestatusOperatorStateState = "success"
)

// ExampleOperatorState defines model for ExampleOperatorState.
// +k8s:openapi-gen=true
type ExampleOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ExampleOperatorStateState `json:"state"`
}

// ExampleOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type ExampleOperatorStateState string

// ExampleStatus defines model for ExampleStatus.
// +k8s:openapi-gen=true
type ExampleStatus struct {
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`

	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]ExamplestatusOperatorState `json:"operatorStates,omitempty"`
}

// ExamplestatusOperatorState defines model for Examplestatus.#OperatorState.
// +k8s:openapi-gen=true
type ExamplestatusOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ExamplestatusOperatorStateState `json:"state"`
}

// ExamplestatusOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type ExamplestatusOperatorStateState string

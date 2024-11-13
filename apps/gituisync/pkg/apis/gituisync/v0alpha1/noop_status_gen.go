package v0alpha1

// Defines values for NoOpOperatorStateState.
const (
	NoOpOperatorStateStateFailed     NoOpOperatorStateState = "failed"
	NoOpOperatorStateStateInProgress NoOpOperatorStateState = "in_progress"
	NoOpOperatorStateStateSuccess    NoOpOperatorStateState = "success"
)

// Defines values for NoOpstatusOperatorStateState.
const (
	NoOpstatusOperatorStateStateFailed     NoOpstatusOperatorStateState = "failed"
	NoOpstatusOperatorStateStateInProgress NoOpstatusOperatorStateState = "in_progress"
	NoOpstatusOperatorStateStateSuccess    NoOpstatusOperatorStateState = "success"
)

// NoOpOperatorState defines model for NoOpOperatorState.
// +k8s:openapi-gen=true
type NoOpOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State NoOpOperatorStateState `json:"state"`
}

// NoOpOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type NoOpOperatorStateState string

// NoOpStatus defines model for NoOpStatus.
// +k8s:openapi-gen=true
type NoOpStatus struct {
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`

	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]NoOpstatusOperatorState `json:"operatorStates,omitempty"`
}

// NoOpstatusOperatorState defines model for NoOpstatus.#OperatorState.
// +k8s:openapi-gen=true
type NoOpstatusOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State NoOpstatusOperatorStateState `json:"state"`
}

// NoOpstatusOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type NoOpstatusOperatorStateState string

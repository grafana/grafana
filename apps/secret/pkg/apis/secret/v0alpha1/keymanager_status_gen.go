package v0alpha1

// Defines values for KeyManagerOperatorStateState.
const (
	KeyManagerOperatorStateStateFailed     KeyManagerOperatorStateState = "failed"
	KeyManagerOperatorStateStateInProgress KeyManagerOperatorStateState = "in_progress"
	KeyManagerOperatorStateStateSuccess    KeyManagerOperatorStateState = "success"
)

// Defines values for KeyManagerstatusOperatorStateState.
const (
	KeyManagerstatusOperatorStateStateFailed     KeyManagerstatusOperatorStateState = "failed"
	KeyManagerstatusOperatorStateStateInProgress KeyManagerstatusOperatorStateState = "in_progress"
	KeyManagerstatusOperatorStateStateSuccess    KeyManagerstatusOperatorStateState = "success"
)

// KeyManagerOperatorState defines model for KeyManagerOperatorState.
// +k8s:openapi-gen=true
type KeyManagerOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State KeyManagerOperatorStateState `json:"state"`
}

// KeyManagerOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type KeyManagerOperatorStateState string

// KeyManagerStatus defines model for KeyManagerStatus.
// +k8s:openapi-gen=true
type KeyManagerStatus struct {
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`

	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]KeyManagerstatusOperatorState `json:"operatorStates,omitempty"`
}

// KeyManagerstatusOperatorState defines model for KeyManagerstatus.#OperatorState.
// +k8s:openapi-gen=true
type KeyManagerstatusOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State KeyManagerstatusOperatorStateState `json:"state"`
}

// KeyManagerstatusOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type KeyManagerstatusOperatorStateState string

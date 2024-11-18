package v0alpha1

// Defines values for SecureValueOperatorStateState.
const (
	SecureValueOperatorStateStateFailed     SecureValueOperatorStateState = "failed"
	SecureValueOperatorStateStateInProgress SecureValueOperatorStateState = "in_progress"
	SecureValueOperatorStateStateSuccess    SecureValueOperatorStateState = "success"
)

// Defines values for SecureValuestatusOperatorStateState.
const (
	SecureValuestatusOperatorStateStateFailed     SecureValuestatusOperatorStateState = "failed"
	SecureValuestatusOperatorStateStateInProgress SecureValuestatusOperatorStateState = "in_progress"
	SecureValuestatusOperatorStateStateSuccess    SecureValuestatusOperatorStateState = "success"
)

// SecureValueOperatorState defines model for SecureValueOperatorState.
// +k8s:openapi-gen=true
type SecureValueOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State SecureValueOperatorStateState `json:"state"`
}

// SecureValueOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type SecureValueOperatorStateState string

// SecureValueStatus defines model for SecureValueStatus.
// +k8s:openapi-gen=true
type SecureValueStatus struct {
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`

	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]SecureValuestatusOperatorState `json:"operatorStates,omitempty"`
}

// SecureValuestatusOperatorState defines model for SecureValuestatus.#OperatorState.
// +k8s:openapi-gen=true
type SecureValuestatusOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State SecureValuestatusOperatorStateState `json:"state"`
}

// SecureValuestatusOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type SecureValuestatusOperatorStateState string

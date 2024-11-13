package v0alpha1

// Defines values for RepositoryOperatorStateState.
const (
	RepositoryOperatorStateStateFailed     RepositoryOperatorStateState = "failed"
	RepositoryOperatorStateStateInProgress RepositoryOperatorStateState = "in_progress"
	RepositoryOperatorStateStateSuccess    RepositoryOperatorStateState = "success"
)

// Defines values for RepositorystatusOperatorStateState.
const (
	RepositorystatusOperatorStateStateFailed     RepositorystatusOperatorStateState = "failed"
	RepositorystatusOperatorStateStateInProgress RepositorystatusOperatorStateState = "in_progress"
	RepositorystatusOperatorStateStateSuccess    RepositorystatusOperatorStateState = "success"
)

// RepositoryOperatorState defines model for RepositoryOperatorState.
// +k8s:openapi-gen=true
type RepositoryOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State RepositoryOperatorStateState `json:"state"`
}

// RepositoryOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type RepositoryOperatorStateState string

// RepositoryStatus defines model for RepositoryStatus.
// +k8s:openapi-gen=true
type RepositoryStatus struct {
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`

	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]RepositorystatusOperatorState `json:"operatorStates,omitempty"`
}

// RepositorystatusOperatorState defines model for Repositorystatus.#OperatorState.
// +k8s:openapi-gen=true
type RepositorystatusOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State RepositorystatusOperatorStateState `json:"state"`
}

// RepositorystatusOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type RepositorystatusOperatorStateState string

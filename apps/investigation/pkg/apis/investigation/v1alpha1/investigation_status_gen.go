package v1alpha1

// Defines values for InvestigationOperatorStateState.
const (
	InvestigationOperatorStateStateFailed     InvestigationOperatorStateState = "failed"
	InvestigationOperatorStateStateInProgress InvestigationOperatorStateState = "in_progress"
	InvestigationOperatorStateStateSuccess    InvestigationOperatorStateState = "success"
)

// Defines values for InvestigationstatusOperatorStateState.
const (
	InvestigationstatusOperatorStateStateFailed     InvestigationstatusOperatorStateState = "failed"
	InvestigationstatusOperatorStateStateInProgress InvestigationstatusOperatorStateState = "in_progress"
	InvestigationstatusOperatorStateStateSuccess    InvestigationstatusOperatorStateState = "success"
)

// InvestigationOperatorState defines model for InvestigationOperatorState.
// +k8s:openapi-gen=true
type InvestigationOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State InvestigationOperatorStateState `json:"state"`
}

// InvestigationOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type InvestigationOperatorStateState string

// InvestigationStatus defines model for InvestigationStatus.
// +k8s:openapi-gen=true
type InvestigationStatus struct {
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`

	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]InvestigationstatusOperatorState `json:"operatorStates,omitempty"`
}

// InvestigationstatusOperatorState defines model for Investigationstatus.#OperatorState.
// +k8s:openapi-gen=true
type InvestigationstatusOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State InvestigationstatusOperatorStateState `json:"state"`
}

// InvestigationstatusOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type InvestigationstatusOperatorStateState string

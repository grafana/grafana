package v0alpha1

// Defines values for TemplateGroupOperatorStateState.
const (
	TemplateGroupOperatorStateStateFailed     TemplateGroupOperatorStateState = "failed"
	TemplateGroupOperatorStateStateInProgress TemplateGroupOperatorStateState = "in_progress"
	TemplateGroupOperatorStateStateSuccess    TemplateGroupOperatorStateState = "success"
)

// Defines values for TemplateGroupstatusOperatorStateState.
const (
	TemplateGroupstatusOperatorStateStateFailed     TemplateGroupstatusOperatorStateState = "failed"
	TemplateGroupstatusOperatorStateStateInProgress TemplateGroupstatusOperatorStateState = "in_progress"
	TemplateGroupstatusOperatorStateStateSuccess    TemplateGroupstatusOperatorStateState = "success"
)

// TemplateGroupOperatorState defines model for TemplateGroupOperatorState.
type TemplateGroupOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]string `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State TemplateGroupOperatorStateState `json:"state"`
}

// TemplateGroupOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
type TemplateGroupOperatorStateState string

// TemplateGroupStatus defines model for TemplateGroupStatus.
type TemplateGroupStatus struct {
	// additionalFields is reserved for future use
	AdditionalFields map[string]string `json:"additionalFields,omitempty"`

	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]TemplateGroupstatusOperatorState `json:"operatorStates,omitempty"`
}

// TemplateGroupstatusOperatorState defines model for TemplateGroupstatus.#OperatorState.
type TemplateGroupstatusOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]string `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State TemplateGroupstatusOperatorStateState `json:"state"`
}

// TemplateGroupstatusOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
type TemplateGroupstatusOperatorStateState string

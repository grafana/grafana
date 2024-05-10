package v0alpha1

// Defines values for TemplateOperatorStateState.
const (
	TemplateOperatorStateStateFailed     TemplateOperatorStateState = "failed"
	TemplateOperatorStateStateInProgress TemplateOperatorStateState = "in_progress"
	TemplateOperatorStateStateSuccess    TemplateOperatorStateState = "success"
)

// Defines values for TemplatestatusOperatorStateState.
const (
	TemplatestatusOperatorStateStateFailed     TemplatestatusOperatorStateState = "failed"
	TemplatestatusOperatorStateStateInProgress TemplatestatusOperatorStateState = "in_progress"
	TemplatestatusOperatorStateStateSuccess    TemplatestatusOperatorStateState = "success"
)

// TemplateOperatorState defines model for TemplateOperatorState.
type TemplateOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]string `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State TemplateOperatorStateState `json:"state"`
}

// TemplateOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
type TemplateOperatorStateState string

// TemplateStatus defines model for TemplateStatus.
type TemplateStatus struct {
	// additionalFields is reserved for future use
	AdditionalFields map[string]string `json:"additionalFields,omitempty"`

	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]TemplatestatusOperatorState `json:"operatorStates,omitempty"`
}

// TemplatestatusOperatorState defines model for Templatestatus.#OperatorState.
type TemplatestatusOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]string `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State TemplatestatusOperatorStateState `json:"state"`
}

// TemplatestatusOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
type TemplatestatusOperatorStateState string

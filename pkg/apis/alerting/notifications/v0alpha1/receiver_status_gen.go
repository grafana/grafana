package v0alpha1

// Defines values for ReceiverOperatorStateState.
const (
	ReceiverOperatorStateStateFailed     ReceiverOperatorStateState = "failed"
	ReceiverOperatorStateStateInProgress ReceiverOperatorStateState = "in_progress"
	ReceiverOperatorStateStateSuccess    ReceiverOperatorStateState = "success"
)

// Defines values for ReceiverstatusOperatorStateState.
const (
	ReceiverstatusOperatorStateStateFailed     ReceiverstatusOperatorStateState = "failed"
	ReceiverstatusOperatorStateStateInProgress ReceiverstatusOperatorStateState = "in_progress"
	ReceiverstatusOperatorStateStateSuccess    ReceiverstatusOperatorStateState = "success"
)

// ReceiverOperatorState defines model for ReceiverOperatorState.
type ReceiverOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]string `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ReceiverOperatorStateState `json:"state"`
}

// ReceiverOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
type ReceiverOperatorStateState string

// ReceiverStatus defines model for ReceiverStatus.
type ReceiverStatus struct {
	// additionalFields is reserved for future use
	AdditionalFields map[string]string `json:"additionalFields,omitempty"`

	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]ReceiverstatusOperatorState `json:"operatorStates,omitempty"`
}

// ReceiverstatusOperatorState defines model for Receiverstatus.#OperatorState.
type ReceiverstatusOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]string `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ReceiverstatusOperatorStateState `json:"state"`
}

// ReceiverstatusOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
type ReceiverstatusOperatorStateState string

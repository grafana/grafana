package v0alpha1

// Defines values for TimeIntervalOperatorStateState.
const (
	TimeIntervalOperatorStateStateFailed     TimeIntervalOperatorStateState = "failed"
	TimeIntervalOperatorStateStateInProgress TimeIntervalOperatorStateState = "in_progress"
	TimeIntervalOperatorStateStateSuccess    TimeIntervalOperatorStateState = "success"
)

// Defines values for TimeIntervalstatusOperatorStateState.
const (
	TimeIntervalstatusOperatorStateStateFailed     TimeIntervalstatusOperatorStateState = "failed"
	TimeIntervalstatusOperatorStateStateInProgress TimeIntervalstatusOperatorStateState = "in_progress"
	TimeIntervalstatusOperatorStateStateSuccess    TimeIntervalstatusOperatorStateState = "success"
)

// TimeIntervalOperatorState defines model for TimeIntervalOperatorState.
type TimeIntervalOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]string `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State TimeIntervalOperatorStateState `json:"state"`
}

// TimeIntervalOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
type TimeIntervalOperatorStateState string

// TimeIntervalStatus defines model for TimeIntervalStatus.
type TimeIntervalStatus struct {
	// // additionalFields is reserved for future use
	AdditionalFields map[string]string `json:"additionalFields,omitempty"`

	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]TimeIntervalstatusOperatorState `json:"operatorStates,omitempty"`
}

// TimeIntervalstatusOperatorState defines model for TimeIntervalstatus.#OperatorState.
type TimeIntervalstatusOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]string `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State TimeIntervalstatusOperatorStateState `json:"state"`
}

// TimeIntervalstatusOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
type TimeIntervalstatusOperatorStateState string

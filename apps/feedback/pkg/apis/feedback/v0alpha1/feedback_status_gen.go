package v0alpha1

// Defines values for FeedbackOperatorStateState.
const (
	FeedbackOperatorStateStateFailed     FeedbackOperatorStateState = "failed"
	FeedbackOperatorStateStateInProgress FeedbackOperatorStateState = "in_progress"
	FeedbackOperatorStateStateSuccess    FeedbackOperatorStateState = "success"
)

// Defines values for FeedbackstatusOperatorStateState.
const (
	FeedbackstatusOperatorStateStateFailed     FeedbackstatusOperatorStateState = "failed"
	FeedbackstatusOperatorStateStateInProgress FeedbackstatusOperatorStateState = "in_progress"
	FeedbackstatusOperatorStateStateSuccess    FeedbackstatusOperatorStateState = "success"
)

// FeedbackOperatorState defines model for FeedbackOperatorState.
// +k8s:openapi-gen=true
type FeedbackOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State FeedbackOperatorStateState `json:"state"`
}

// FeedbackOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type FeedbackOperatorStateState string

// FeedbackStatus defines model for FeedbackStatus.
// +k8s:openapi-gen=true
type FeedbackStatus struct {
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`

	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]FeedbackstatusOperatorState `json:"operatorStates,omitempty"`
}

// FeedbackstatusOperatorState defines model for Feedbackstatus.#OperatorState.
// +k8s:openapi-gen=true
type FeedbackstatusOperatorState struct {
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`

	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`

	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`

	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State FeedbackstatusOperatorStateState `json:"state"`
}

// FeedbackstatusOperatorStateState state describes the state of the lastEvaluation.
// It is limited to three possible states for machine evaluation.
// +k8s:openapi-gen=true
type FeedbackstatusOperatorStateState string

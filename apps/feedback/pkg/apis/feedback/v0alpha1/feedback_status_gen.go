// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type FeedbackstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State FeedbackStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]any `json:"details,omitempty"`
}

// NewFeedbackstatusOperatorState creates a new FeedbackstatusOperatorState object.
func NewFeedbackstatusOperatorState() *FeedbackstatusOperatorState {
	return &FeedbackstatusOperatorState{}
}

// +k8s:openapi-gen=true
type FeedbackStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]FeedbackstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]any `json:"additionalFields,omitempty"`
}

// NewFeedbackStatus creates a new FeedbackStatus object.
func NewFeedbackStatus() *FeedbackStatus {
	return &FeedbackStatus{}
}

// +k8s:openapi-gen=true
type FeedbackStatusOperatorStateState string

const (
	StatusOperatorStateStateSuccess    FeedbackStatusOperatorStateState = "success"
	StatusOperatorStateStateInProgress FeedbackStatusOperatorStateState = "in_progress"
	StatusOperatorStateStateFailed     FeedbackStatusOperatorStateState = "failed"
)

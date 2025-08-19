// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type TimeIntervalstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State TimeIntervalStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewTimeIntervalstatusOperatorState creates a new TimeIntervalstatusOperatorState object.
func NewTimeIntervalstatusOperatorState() *TimeIntervalstatusOperatorState {
	return &TimeIntervalstatusOperatorState{}
}

// +k8s:openapi-gen=true
type TimeIntervalStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]TimeIntervalstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewTimeIntervalStatus creates a new TimeIntervalStatus object.
func NewTimeIntervalStatus() *TimeIntervalStatus {
	return &TimeIntervalStatus{}
}

// +k8s:openapi-gen=true
type TimeIntervalStatusOperatorStateState string

const (
	TimeIntervalStatusOperatorStateStateSuccess    TimeIntervalStatusOperatorStateState = "success"
	TimeIntervalStatusOperatorStateStateInProgress TimeIntervalStatusOperatorStateState = "in_progress"
	TimeIntervalStatusOperatorStateStateFailed     TimeIntervalStatusOperatorStateState = "failed"
)

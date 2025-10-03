// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type LogsstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State LogsStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewLogsstatusOperatorState creates a new LogsstatusOperatorState object.
func NewLogsstatusOperatorState() *LogsstatusOperatorState {
	return &LogsstatusOperatorState{}
}

// +k8s:openapi-gen=true
type LogsStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]LogsstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewLogsStatus creates a new LogsStatus object.
func NewLogsStatus() *LogsStatus {
	return &LogsStatus{}
}

// +k8s:openapi-gen=true
type LogsStatusOperatorStateState string

const (
	LogsStatusOperatorStateStateSuccess    LogsStatusOperatorStateState = "success"
	LogsStatusOperatorStateStateInProgress LogsStatusOperatorStateState = "in_progress"
	LogsStatusOperatorStateStateFailed     LogsStatusOperatorStateState = "failed"
)

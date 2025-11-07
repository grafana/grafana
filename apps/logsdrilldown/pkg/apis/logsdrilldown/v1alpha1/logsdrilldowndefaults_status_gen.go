// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type LogsDrilldownDefaultsstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State LogsDrilldownDefaultsStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewLogsDrilldownDefaultsstatusOperatorState creates a new LogsDrilldownDefaultsstatusOperatorState object.
func NewLogsDrilldownDefaultsstatusOperatorState() *LogsDrilldownDefaultsstatusOperatorState {
	return &LogsDrilldownDefaultsstatusOperatorState{}
}

// +k8s:openapi-gen=true
type LogsDrilldownDefaultsStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]LogsDrilldownDefaultsstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewLogsDrilldownDefaultsStatus creates a new LogsDrilldownDefaultsStatus object.
func NewLogsDrilldownDefaultsStatus() *LogsDrilldownDefaultsStatus {
	return &LogsDrilldownDefaultsStatus{}
}

// +k8s:openapi-gen=true
type LogsDrilldownDefaultsStatusOperatorStateState string

const (
	LogsDrilldownDefaultsStatusOperatorStateStateSuccess    LogsDrilldownDefaultsStatusOperatorStateState = "success"
	LogsDrilldownDefaultsStatusOperatorStateStateInProgress LogsDrilldownDefaultsStatusOperatorStateState = "in_progress"
	LogsDrilldownDefaultsStatusOperatorStateStateFailed     LogsDrilldownDefaultsStatusOperatorStateState = "failed"
)

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type CorrelationstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State CorrelationStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewCorrelationstatusOperatorState creates a new CorrelationstatusOperatorState object.
func NewCorrelationstatusOperatorState() *CorrelationstatusOperatorState {
	return &CorrelationstatusOperatorState{}
}

// +k8s:openapi-gen=true
type CorrelationStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]CorrelationstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewCorrelationStatus creates a new CorrelationStatus object.
func NewCorrelationStatus() *CorrelationStatus {
	return &CorrelationStatus{}
}

// +k8s:openapi-gen=true
type CorrelationStatusOperatorStateState string

const (
	CorrelationStatusOperatorStateStateSuccess    CorrelationStatusOperatorStateState = "success"
	CorrelationStatusOperatorStateStateInProgress CorrelationStatusOperatorStateState = "in_progress"
	CorrelationStatusOperatorStateStateFailed     CorrelationStatusOperatorStateState = "failed"
)

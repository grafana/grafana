// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type QuerystatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State QueryStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewQuerystatusOperatorState creates a new QuerystatusOperatorState object.
func NewQuerystatusOperatorState() *QuerystatusOperatorState {
	return &QuerystatusOperatorState{}
}

// +k8s:openapi-gen=true
type QueryStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]QuerystatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewQueryStatus creates a new QueryStatus object.
func NewQueryStatus() *QueryStatus {
	return &QueryStatus{}
}

// +k8s:openapi-gen=true
type QueryStatusOperatorStateState string

const (
	QueryStatusOperatorStateStateSuccess    QueryStatusOperatorStateState = "success"
	QueryStatusOperatorStateStateInProgress QueryStatusOperatorStateState = "in_progress"
	QueryStatusOperatorStateStateFailed     QueryStatusOperatorStateState = "failed"
)

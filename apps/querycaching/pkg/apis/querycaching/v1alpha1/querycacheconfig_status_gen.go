// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type QueryCacheConfigstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State QueryCacheConfigStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewQueryCacheConfigstatusOperatorState creates a new QueryCacheConfigstatusOperatorState object.
func NewQueryCacheConfigstatusOperatorState() *QueryCacheConfigstatusOperatorState {
	return &QueryCacheConfigstatusOperatorState{}
}

// +k8s:openapi-gen=true
type QueryCacheConfigStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]QueryCacheConfigstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewQueryCacheConfigStatus creates a new QueryCacheConfigStatus object.
func NewQueryCacheConfigStatus() *QueryCacheConfigStatus {
	return &QueryCacheConfigStatus{}
}

// +k8s:openapi-gen=true
type QueryCacheConfigStatusOperatorStateState string

const (
	QueryCacheConfigStatusOperatorStateStateSuccess    QueryCacheConfigStatusOperatorStateState = "success"
	QueryCacheConfigStatusOperatorStateStateInProgress QueryCacheConfigStatusOperatorStateState = "in_progress"
	QueryCacheConfigStatusOperatorStateStateFailed     QueryCacheConfigStatusOperatorStateState = "failed"
)

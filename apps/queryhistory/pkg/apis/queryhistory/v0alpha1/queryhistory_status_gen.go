// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type QueryHistorystatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State QueryHistoryStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewQueryHistorystatusOperatorState creates a new QueryHistorystatusOperatorState object.
func NewQueryHistorystatusOperatorState() *QueryHistorystatusOperatorState {
	return &QueryHistorystatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for QueryHistorystatusOperatorState.
func (QueryHistorystatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.queryhistory.pkg.apis.queryhistory.v0alpha1.QueryHistorystatusOperatorState"
}

// +k8s:openapi-gen=true
type QueryHistoryStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]QueryHistorystatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewQueryHistoryStatus creates a new QueryHistoryStatus object.
func NewQueryHistoryStatus() *QueryHistoryStatus {
	return &QueryHistoryStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for QueryHistoryStatus.
func (QueryHistoryStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.queryhistory.pkg.apis.queryhistory.v0alpha1.QueryHistoryStatus"
}

// +k8s:openapi-gen=true
type QueryHistoryStatusOperatorStateState string

const (
	QueryHistoryStatusOperatorStateStateSuccess    QueryHistoryStatusOperatorStateState = "success"
	QueryHistoryStatusOperatorStateStateInProgress QueryHistoryStatusOperatorStateState = "in_progress"
	QueryHistoryStatusOperatorStateStateFailed     QueryHistoryStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for QueryHistoryStatusOperatorStateState.
func (QueryHistoryStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.queryhistory.pkg.apis.queryhistory.v0alpha1.QueryHistoryStatusOperatorStateState"
}

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GlobalLeasestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State GlobalLeaseStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewGlobalLeasestatusOperatorState creates a new GlobalLeasestatusOperatorState object.
func NewGlobalLeasestatusOperatorState() *GlobalLeasestatusOperatorState {
	return &GlobalLeasestatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for GlobalLeasestatusOperatorState.
func (GlobalLeasestatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.coordination.pkg.apis.coordination.v0alpha1.GlobalLeasestatusOperatorState"
}

// +k8s:openapi-gen=true
type GlobalLeaseStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]GlobalLeasestatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewGlobalLeaseStatus creates a new GlobalLeaseStatus object.
func NewGlobalLeaseStatus() *GlobalLeaseStatus {
	return &GlobalLeaseStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for GlobalLeaseStatus.
func (GlobalLeaseStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.coordination.pkg.apis.coordination.v0alpha1.GlobalLeaseStatus"
}

// +k8s:openapi-gen=true
type GlobalLeaseStatusOperatorStateState string

const (
	GlobalLeaseStatusOperatorStateStateSuccess    GlobalLeaseStatusOperatorStateState = "success"
	GlobalLeaseStatusOperatorStateStateInProgress GlobalLeaseStatusOperatorStateState = "in_progress"
	GlobalLeaseStatusOperatorStateStateFailed     GlobalLeaseStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for GlobalLeaseStatusOperatorStateState.
func (GlobalLeaseStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.coordination.pkg.apis.coordination.v0alpha1.GlobalLeaseStatusOperatorStateState"
}

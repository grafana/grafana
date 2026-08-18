// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type LeasestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State LeaseStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewLeasestatusOperatorState creates a new LeasestatusOperatorState object.
func NewLeasestatusOperatorState() *LeasestatusOperatorState {
	return &LeasestatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for LeasestatusOperatorState.
func (LeasestatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.coordination.pkg.apis.coordination.v0alpha1.LeasestatusOperatorState"
}

// +k8s:openapi-gen=true
type LeaseStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]LeasestatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewLeaseStatus creates a new LeaseStatus object.
func NewLeaseStatus() *LeaseStatus {
	return &LeaseStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for LeaseStatus.
func (LeaseStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.coordination.pkg.apis.coordination.v0alpha1.LeaseStatus"
}

// +k8s:openapi-gen=true
type LeaseStatusOperatorStateState string

const (
	LeaseStatusOperatorStateStateSuccess    LeaseStatusOperatorStateState = "success"
	LeaseStatusOperatorStateStateInProgress LeaseStatusOperatorStateState = "in_progress"
	LeaseStatusOperatorStateStateFailed     LeaseStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for LeaseStatusOperatorStateState.
func (LeaseStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.coordination.pkg.apis.coordination.v0alpha1.LeaseStatusOperatorStateState"
}

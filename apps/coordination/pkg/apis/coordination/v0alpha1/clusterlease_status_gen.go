// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ClusterLeasestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ClusterLeaseStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewClusterLeasestatusOperatorState creates a new ClusterLeasestatusOperatorState object.
func NewClusterLeasestatusOperatorState() *ClusterLeasestatusOperatorState {
	return &ClusterLeasestatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for ClusterLeasestatusOperatorState.
func (ClusterLeasestatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.coordination.pkg.apis.coordination.v0alpha1.ClusterLeasestatusOperatorState"
}

// +k8s:openapi-gen=true
type ClusterLeaseStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]ClusterLeasestatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewClusterLeaseStatus creates a new ClusterLeaseStatus object.
func NewClusterLeaseStatus() *ClusterLeaseStatus {
	return &ClusterLeaseStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for ClusterLeaseStatus.
func (ClusterLeaseStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.coordination.pkg.apis.coordination.v0alpha1.ClusterLeaseStatus"
}

// +k8s:openapi-gen=true
type ClusterLeaseStatusOperatorStateState string

const (
	ClusterLeaseStatusOperatorStateStateSuccess    ClusterLeaseStatusOperatorStateState = "success"
	ClusterLeaseStatusOperatorStateStateInProgress ClusterLeaseStatusOperatorStateState = "in_progress"
	ClusterLeaseStatusOperatorStateStateFailed     ClusterLeaseStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for ClusterLeaseStatusOperatorStateState.
func (ClusterLeaseStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.coordination.pkg.apis.coordination.v0alpha1.ClusterLeaseStatusOperatorStateState"
}

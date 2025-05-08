// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ClusterRoleBindingstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ClusterRoleBindingStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewClusterRoleBindingstatusOperatorState creates a new ClusterRoleBindingstatusOperatorState object.
func NewClusterRoleBindingstatusOperatorState() *ClusterRoleBindingstatusOperatorState {
	return &ClusterRoleBindingstatusOperatorState{}
}

// +k8s:openapi-gen=true
type ClusterRoleBindingStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]ClusterRoleBindingstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewClusterRoleBindingStatus creates a new ClusterRoleBindingStatus object.
func NewClusterRoleBindingStatus() *ClusterRoleBindingStatus {
	return &ClusterRoleBindingStatus{}
}

// +k8s:openapi-gen=true
type ClusterRoleBindingStatusOperatorStateState string

const (
	ClusterRoleBindingStatusOperatorStateStateSuccess    ClusterRoleBindingStatusOperatorStateState = "success"
	ClusterRoleBindingStatusOperatorStateStateInProgress ClusterRoleBindingStatusOperatorStateState = "in_progress"
	ClusterRoleBindingStatusOperatorStateStateFailed     ClusterRoleBindingStatusOperatorStateState = "failed"
)

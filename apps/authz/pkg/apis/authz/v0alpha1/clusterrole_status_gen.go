// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ClusterRolestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ClusterRoleStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewClusterRolestatusOperatorState creates a new ClusterRolestatusOperatorState object.
func NewClusterRolestatusOperatorState() *ClusterRolestatusOperatorState {
	return &ClusterRolestatusOperatorState{}
}

// +k8s:openapi-gen=true
type ClusterRoleStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]ClusterRolestatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewClusterRoleStatus creates a new ClusterRoleStatus object.
func NewClusterRoleStatus() *ClusterRoleStatus {
	return &ClusterRoleStatus{}
}

// +k8s:openapi-gen=true
type ClusterRoleStatusOperatorStateState string

const (
	ClusterRoleStatusOperatorStateStateSuccess    ClusterRoleStatusOperatorStateState = "success"
	ClusterRoleStatusOperatorStateStateInProgress ClusterRoleStatusOperatorStateState = "in_progress"
	ClusterRoleStatusOperatorStateStateFailed     ClusterRoleStatusOperatorStateState = "failed"
)

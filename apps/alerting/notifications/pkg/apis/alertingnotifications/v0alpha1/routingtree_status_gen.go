// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RoutingTreestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State RoutingTreeStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewRoutingTreestatusOperatorState creates a new RoutingTreestatusOperatorState object.
func NewRoutingTreestatusOperatorState() *RoutingTreestatusOperatorState {
	return &RoutingTreestatusOperatorState{}
}

// +k8s:openapi-gen=true
type RoutingTreeStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]RoutingTreestatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewRoutingTreeStatus creates a new RoutingTreeStatus object.
func NewRoutingTreeStatus() *RoutingTreeStatus {
	return &RoutingTreeStatus{}
}

// +k8s:openapi-gen=true
type RoutingTreeStatusOperatorStateState string

const (
	RoutingTreeStatusOperatorStateStateSuccess    RoutingTreeStatusOperatorStateState = "success"
	RoutingTreeStatusOperatorStateStateInProgress RoutingTreeStatusOperatorStateState = "in_progress"
	RoutingTreeStatusOperatorStateStateFailed     RoutingTreeStatusOperatorStateState = "failed"
)

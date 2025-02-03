// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type DashboardstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State DashboardStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewDashboardstatusOperatorState creates a new DashboardstatusOperatorState object.
func NewDashboardstatusOperatorState() *DashboardstatusOperatorState {
	return &DashboardstatusOperatorState{}
}

// +k8s:openapi-gen=true
type DashboardStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]DashboardstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewDashboardStatus creates a new DashboardStatus object.
func NewDashboardStatus() *DashboardStatus {
	return &DashboardStatus{}
}

// +k8s:openapi-gen=true
type DashboardStatusOperatorStateState string

const (
	DashboardStatusOperatorStateStateSuccess    DashboardStatusOperatorStateState = "success"
	DashboardStatusOperatorStateStateInProgress DashboardStatusOperatorStateState = "in_progress"
	DashboardStatusOperatorStateStateFailed     DashboardStatusOperatorStateState = "failed"
)

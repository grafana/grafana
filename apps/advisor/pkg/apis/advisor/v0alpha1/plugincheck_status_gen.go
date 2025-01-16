// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PluginCheckstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State PluginCheckStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]any `json:"details,omitempty"`
}

// NewPluginCheckstatusOperatorState creates a new PluginCheckstatusOperatorState object.
func NewPluginCheckstatusOperatorState() *PluginCheckstatusOperatorState {
	return &PluginCheckstatusOperatorState{}
}

// +k8s:openapi-gen=true
type PluginCheckStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]PluginCheckstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]any `json:"additionalFields,omitempty"`
}

// NewPluginCheckStatus creates a new PluginCheckStatus object.
func NewPluginCheckStatus() *PluginCheckStatus {
	return &PluginCheckStatus{}
}

// +k8s:openapi-gen=true
type PluginCheckStatusOperatorStateState string

const (
	PluginCheckStatusOperatorStateStateSuccess    PluginCheckStatusOperatorStateState = "success"
	PluginCheckStatusOperatorStateStateInProgress PluginCheckStatusOperatorStateState = "in_progress"
	PluginCheckStatusOperatorStateStateFailed     PluginCheckStatusOperatorStateState = "failed"
)

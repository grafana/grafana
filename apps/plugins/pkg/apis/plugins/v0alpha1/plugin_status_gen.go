// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PluginstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State PluginStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewPluginstatusOperatorState creates a new PluginstatusOperatorState object.
func NewPluginstatusOperatorState() *PluginstatusOperatorState {
	return &PluginstatusOperatorState{}
}

// +k8s:openapi-gen=true
type PluginStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]PluginstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewPluginStatus creates a new PluginStatus object.
func NewPluginStatus() *PluginStatus {
	return &PluginStatus{}
}

// +k8s:openapi-gen=true
type PluginStatusOperatorStateState string

const (
	PluginStatusOperatorStateStateSuccess    PluginStatusOperatorStateState = "success"
	PluginStatusOperatorStateStateInProgress PluginStatusOperatorStateState = "in_progress"
	PluginStatusOperatorStateStateFailed     PluginStatusOperatorStateState = "failed"
)

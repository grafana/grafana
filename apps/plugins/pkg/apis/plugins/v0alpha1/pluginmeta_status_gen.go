// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PluginMetastatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State PluginMetaStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewPluginMetastatusOperatorState creates a new PluginMetastatusOperatorState object.
func NewPluginMetastatusOperatorState() *PluginMetastatusOperatorState {
	return &PluginMetastatusOperatorState{}
}

// +k8s:openapi-gen=true
type PluginMetaStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]PluginMetastatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewPluginMetaStatus creates a new PluginMetaStatus object.
func NewPluginMetaStatus() *PluginMetaStatus {
	return &PluginMetaStatus{}
}

// +k8s:openapi-gen=true
type PluginMetaStatusOperatorStateState string

const (
	PluginMetaStatusOperatorStateStateSuccess    PluginMetaStatusOperatorStateState = "success"
	PluginMetaStatusOperatorStateStateInProgress PluginMetaStatusOperatorStateState = "in_progress"
	PluginMetaStatusOperatorStateStateFailed     PluginMetaStatusOperatorStateState = "failed"
)

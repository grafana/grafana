// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PluginInstallstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State PluginInstallStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewPluginInstallstatusOperatorState creates a new PluginInstallstatusOperatorState object.
func NewPluginInstallstatusOperatorState() *PluginInstallstatusOperatorState {
	return &PluginInstallstatusOperatorState{}
}

// +k8s:openapi-gen=true
type PluginInstallStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]PluginInstallstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewPluginInstallStatus creates a new PluginInstallStatus object.
func NewPluginInstallStatus() *PluginInstallStatus {
	return &PluginInstallStatus{}
}

// +k8s:openapi-gen=true
type PluginInstallStatusOperatorStateState string

const (
	PluginInstallStatusOperatorStateStateSuccess    PluginInstallStatusOperatorStateState = "success"
	PluginInstallStatusOperatorStateStateInProgress PluginInstallStatusOperatorStateState = "in_progress"
	PluginInstallStatusOperatorStateStateFailed     PluginInstallStatusOperatorStateState = "failed"
)

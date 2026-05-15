// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AppstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State AppStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewAppstatusOperatorState creates a new AppstatusOperatorState object.
func NewAppstatusOperatorState() *AppstatusOperatorState {
	return &AppstatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for AppstatusOperatorState.
func (AppstatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.plugins.pkg.apis.plugins.v0alpha1.AppstatusOperatorState"
}

// +k8s:openapi-gen=true
type AppStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]AppstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewAppStatus creates a new AppStatus object.
func NewAppStatus() *AppStatus {
	return &AppStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for AppStatus.
func (AppStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.plugins.pkg.apis.plugins.v0alpha1.AppStatus"
}

// +k8s:openapi-gen=true
type AppStatusOperatorStateState string

const (
	AppStatusOperatorStateStateSuccess    AppStatusOperatorStateState = "success"
	AppStatusOperatorStateStateInProgress AppStatusOperatorStateState = "in_progress"
	AppStatusOperatorStateStateFailed     AppStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for AppStatusOperatorStateState.
func (AppStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.plugins.pkg.apis.plugins.v0alpha1.AppStatusOperatorStateState"
}

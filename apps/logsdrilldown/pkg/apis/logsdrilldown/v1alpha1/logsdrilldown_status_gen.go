// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type LogsDrilldownstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State LogsDrilldownStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewLogsDrilldownstatusOperatorState creates a new LogsDrilldownstatusOperatorState object.
func NewLogsDrilldownstatusOperatorState() *LogsDrilldownstatusOperatorState {
	return &LogsDrilldownstatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for LogsDrilldownstatusOperatorState.
func (LogsDrilldownstatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.logsdrilldown.pkg.apis.logsdrilldown.v1alpha1.LogsDrilldownstatusOperatorState"
}

// +k8s:openapi-gen=true
type LogsDrilldownStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]LogsDrilldownstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewLogsDrilldownStatus creates a new LogsDrilldownStatus object.
func NewLogsDrilldownStatus() *LogsDrilldownStatus {
	return &LogsDrilldownStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for LogsDrilldownStatus.
func (LogsDrilldownStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.logsdrilldown.pkg.apis.logsdrilldown.v1alpha1.LogsDrilldownStatus"
}

// +k8s:openapi-gen=true
type LogsDrilldownStatusOperatorStateState string

const (
	LogsDrilldownStatusOperatorStateStateSuccess    LogsDrilldownStatusOperatorStateState = "success"
	LogsDrilldownStatusOperatorStateStateInProgress LogsDrilldownStatusOperatorStateState = "in_progress"
	LogsDrilldownStatusOperatorStateStateFailed     LogsDrilldownStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for LogsDrilldownStatusOperatorStateState.
func (LogsDrilldownStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.logsdrilldown.pkg.apis.logsdrilldown.v1alpha1.LogsDrilldownStatusOperatorStateState"
}

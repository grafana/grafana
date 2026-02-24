// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type LogsDrilldownDefaultColumnsstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State LogsDrilldownDefaultColumnsStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewLogsDrilldownDefaultColumnsstatusOperatorState creates a new LogsDrilldownDefaultColumnsstatusOperatorState object.
func NewLogsDrilldownDefaultColumnsstatusOperatorState() *LogsDrilldownDefaultColumnsstatusOperatorState {
	return &LogsDrilldownDefaultColumnsstatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for LogsDrilldownDefaultColumnsstatusOperatorState.
func (LogsDrilldownDefaultColumnsstatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.logsdrilldown.pkg.apis.logsdrilldown.v1beta1.LogsDrilldownDefaultColumnsstatusOperatorState"
}

// +k8s:openapi-gen=true
type LogsDrilldownDefaultColumnsStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]LogsDrilldownDefaultColumnsstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewLogsDrilldownDefaultColumnsStatus creates a new LogsDrilldownDefaultColumnsStatus object.
func NewLogsDrilldownDefaultColumnsStatus() *LogsDrilldownDefaultColumnsStatus {
	return &LogsDrilldownDefaultColumnsStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for LogsDrilldownDefaultColumnsStatus.
func (LogsDrilldownDefaultColumnsStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.logsdrilldown.pkg.apis.logsdrilldown.v1beta1.LogsDrilldownDefaultColumnsStatus"
}

// +k8s:openapi-gen=true
type LogsDrilldownDefaultColumnsStatusOperatorStateState string

const (
	LogsDrilldownDefaultColumnsStatusOperatorStateStateSuccess    LogsDrilldownDefaultColumnsStatusOperatorStateState = "success"
	LogsDrilldownDefaultColumnsStatusOperatorStateStateInProgress LogsDrilldownDefaultColumnsStatusOperatorStateState = "in_progress"
	LogsDrilldownDefaultColumnsStatusOperatorStateStateFailed     LogsDrilldownDefaultColumnsStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for LogsDrilldownDefaultColumnsStatusOperatorStateState.
func (LogsDrilldownDefaultColumnsStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.logsdrilldown.pkg.apis.logsdrilldown.v1beta1.LogsDrilldownDefaultColumnsStatusOperatorStateState"
}

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type LogsDrilldownDefaultLabelsstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State LogsDrilldownDefaultLabelsStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewLogsDrilldownDefaultLabelsstatusOperatorState creates a new LogsDrilldownDefaultLabelsstatusOperatorState object.
func NewLogsDrilldownDefaultLabelsstatusOperatorState() *LogsDrilldownDefaultLabelsstatusOperatorState {
	return &LogsDrilldownDefaultLabelsstatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for LogsDrilldownDefaultLabelsstatusOperatorState.
func (LogsDrilldownDefaultLabelsstatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.logsdrilldown.pkg.apis.logsdrilldown.v1beta1.LogsDrilldownDefaultLabelsstatusOperatorState"
}

// +k8s:openapi-gen=true
type LogsDrilldownDefaultLabelsStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]LogsDrilldownDefaultLabelsstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewLogsDrilldownDefaultLabelsStatus creates a new LogsDrilldownDefaultLabelsStatus object.
func NewLogsDrilldownDefaultLabelsStatus() *LogsDrilldownDefaultLabelsStatus {
	return &LogsDrilldownDefaultLabelsStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for LogsDrilldownDefaultLabelsStatus.
func (LogsDrilldownDefaultLabelsStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.logsdrilldown.pkg.apis.logsdrilldown.v1beta1.LogsDrilldownDefaultLabelsStatus"
}

// +k8s:openapi-gen=true
type LogsDrilldownDefaultLabelsStatusOperatorStateState string

const (
	LogsDrilldownDefaultLabelsStatusOperatorStateStateSuccess    LogsDrilldownDefaultLabelsStatusOperatorStateState = "success"
	LogsDrilldownDefaultLabelsStatusOperatorStateStateInProgress LogsDrilldownDefaultLabelsStatusOperatorStateState = "in_progress"
	LogsDrilldownDefaultLabelsStatusOperatorStateStateFailed     LogsDrilldownDefaultLabelsStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for LogsDrilldownDefaultLabelsStatusOperatorStateState.
func (LogsDrilldownDefaultLabelsStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.logsdrilldown.pkg.apis.logsdrilldown.v1beta1.LogsDrilldownDefaultLabelsStatusOperatorStateState"
}

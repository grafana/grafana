// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PrometheusRulestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State PrometheusRuleStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewPrometheusRulestatusOperatorState creates a new PrometheusRulestatusOperatorState object.
func NewPrometheusRulestatusOperatorState() *PrometheusRulestatusOperatorState {
	return &PrometheusRulestatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for PrometheusRulestatusOperatorState.
func (PrometheusRulestatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.PrometheusRulestatusOperatorState"
}

// +k8s:openapi-gen=true
type PrometheusRuleStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]PrometheusRulestatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewPrometheusRuleStatus creates a new PrometheusRuleStatus object.
func NewPrometheusRuleStatus() *PrometheusRuleStatus {
	return &PrometheusRuleStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for PrometheusRuleStatus.
func (PrometheusRuleStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.PrometheusRuleStatus"
}

// +k8s:openapi-gen=true
type PrometheusRuleStatusOperatorStateState string

const (
	PrometheusRuleStatusOperatorStateStateSuccess    PrometheusRuleStatusOperatorStateState = "success"
	PrometheusRuleStatusOperatorStateStateInProgress PrometheusRuleStatusOperatorStateState = "in_progress"
	PrometheusRuleStatusOperatorStateStateFailed     PrometheusRuleStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for PrometheusRuleStatusOperatorStateState.
func (PrometheusRuleStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.PrometheusRuleStatusOperatorStateState"
}

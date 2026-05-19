// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PrometheusRuleFilestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State PrometheusRuleFileStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewPrometheusRuleFilestatusOperatorState creates a new PrometheusRuleFilestatusOperatorState object.
func NewPrometheusRuleFilestatusOperatorState() *PrometheusRuleFilestatusOperatorState {
	return &PrometheusRuleFilestatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for PrometheusRuleFilestatusOperatorState.
func (PrometheusRuleFilestatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules-extensions.pkg.apis.rulesextensions.v0alpha1.PrometheusRuleFilestatusOperatorState"
}

// +k8s:openapi-gen=true
type PrometheusRuleFileStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]PrometheusRuleFilestatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewPrometheusRuleFileStatus creates a new PrometheusRuleFileStatus object.
func NewPrometheusRuleFileStatus() *PrometheusRuleFileStatus {
	return &PrometheusRuleFileStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for PrometheusRuleFileStatus.
func (PrometheusRuleFileStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules-extensions.pkg.apis.rulesextensions.v0alpha1.PrometheusRuleFileStatus"
}

// +k8s:openapi-gen=true
type PrometheusRuleFileStatusOperatorStateState string

const (
	PrometheusRuleFileStatusOperatorStateStateSuccess    PrometheusRuleFileStatusOperatorStateState = "success"
	PrometheusRuleFileStatusOperatorStateStateInProgress PrometheusRuleFileStatusOperatorStateState = "in_progress"
	PrometheusRuleFileStatusOperatorStateStateFailed     PrometheusRuleFileStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for PrometheusRuleFileStatusOperatorStateState.
func (PrometheusRuleFileStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules-extensions.pkg.apis.rulesextensions.v0alpha1.PrometheusRuleFileStatusOperatorStateState"
}

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PrometheusRuleGroupstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State PrometheusRuleGroupStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewPrometheusRuleGroupstatusOperatorState creates a new PrometheusRuleGroupstatusOperatorState object.
func NewPrometheusRuleGroupstatusOperatorState() *PrometheusRuleGroupstatusOperatorState {
	return &PrometheusRuleGroupstatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for PrometheusRuleGroupstatusOperatorState.
func (PrometheusRuleGroupstatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules-extensions.pkg.apis.rulesextensions.v0alpha1.PrometheusRuleGroupstatusOperatorState"
}

// +k8s:openapi-gen=true
type PrometheusRuleGroupStatus struct {
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]PrometheusRuleGroupstatusOperatorState `json:"operatorStates,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewPrometheusRuleGroupStatus creates a new PrometheusRuleGroupStatus object.
func NewPrometheusRuleGroupStatus() *PrometheusRuleGroupStatus {
	return &PrometheusRuleGroupStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for PrometheusRuleGroupStatus.
func (PrometheusRuleGroupStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules-extensions.pkg.apis.rulesextensions.v0alpha1.PrometheusRuleGroupStatus"
}

// +k8s:openapi-gen=true
type PrometheusRuleGroupStatusOperatorStateState string

const (
	PrometheusRuleGroupStatusOperatorStateStateSuccess    PrometheusRuleGroupStatusOperatorStateState = "success"
	PrometheusRuleGroupStatusOperatorStateStateInProgress PrometheusRuleGroupStatusOperatorStateState = "in_progress"
	PrometheusRuleGroupStatusOperatorStateStateFailed     PrometheusRuleGroupStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for PrometheusRuleGroupStatusOperatorStateState.
func (PrometheusRuleGroupStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules-extensions.pkg.apis.rulesextensions.v0alpha1.PrometheusRuleGroupStatusOperatorStateState"
}

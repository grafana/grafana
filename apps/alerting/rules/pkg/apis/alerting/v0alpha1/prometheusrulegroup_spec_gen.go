// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PrometheusRuleGroupPromDuration string

// +k8s:openapi-gen=true
type PrometheusRuleGroupPrometheusRule struct {
	Alert         *string                          `json:"alert,omitempty"`
	Record        *string                          `json:"record,omitempty"`
	Expr          string                           `json:"expr"`
	For           *PrometheusRuleGroupPromDuration `json:"for,omitempty"`
	KeepFiringFor *PrometheusRuleGroupPromDuration `json:"keepFiringFor,omitempty"`
	Labels        map[string]string                `json:"labels,omitempty"`
	Annotations   map[string]string                `json:"annotations,omitempty"`
}

// NewPrometheusRuleGroupPrometheusRule creates a new PrometheusRuleGroupPrometheusRule object.
func NewPrometheusRuleGroupPrometheusRule() *PrometheusRuleGroupPrometheusRule {
	return &PrometheusRuleGroupPrometheusRule{}
}

// OpenAPIModelName returns the OpenAPI model name for PrometheusRuleGroupPrometheusRule.
func (PrometheusRuleGroupPrometheusRule) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.PrometheusRuleGroupPrometheusRule"
}

// +k8s:openapi-gen=true
type PrometheusRuleGroupSpec struct {
	Name        string                              `json:"name"`
	Interval    *PrometheusRuleGroupPromDuration    `json:"interval,omitempty"`
	QueryOffset *PrometheusRuleGroupPromDuration    `json:"queryOffset,omitempty"`
	Limit       *int64                              `json:"limit,omitempty"`
	Labels      map[string]string                   `json:"labels,omitempty"`
	Rules       []PrometheusRuleGroupPrometheusRule `json:"rules"`
}

// NewPrometheusRuleGroupSpec creates a new PrometheusRuleGroupSpec object.
func NewPrometheusRuleGroupSpec() *PrometheusRuleGroupSpec {
	return &PrometheusRuleGroupSpec{
		Rules: []PrometheusRuleGroupPrometheusRule{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for PrometheusRuleGroupSpec.
func (PrometheusRuleGroupSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.PrometheusRuleGroupSpec"
}

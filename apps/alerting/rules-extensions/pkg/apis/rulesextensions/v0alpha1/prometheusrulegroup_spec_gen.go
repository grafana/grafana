// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PrometheusRuleGroupPrometheusRuleGroup struct {
	Name        string                           `json:"name"`
	Interval    *PrometheusRuleGroupPromDuration `json:"interval,omitempty"`
	QueryOffset *PrometheusRuleGroupPromDuration `json:"queryOffset,omitempty"`
	Limit       *int64                           `json:"limit,omitempty"`
	Labels      map[string]string                `json:"labels,omitempty"`
	Rules       []PrometheusRuleGroupRuleEntry   `json:"rules"`
}

// NewPrometheusRuleGroupPrometheusRuleGroup creates a new PrometheusRuleGroupPrometheusRuleGroup object.
func NewPrometheusRuleGroupPrometheusRuleGroup() *PrometheusRuleGroupPrometheusRuleGroup {
	return &PrometheusRuleGroupPrometheusRuleGroup{
		Rules: []PrometheusRuleGroupRuleEntry{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for PrometheusRuleGroupPrometheusRuleGroup.
func (PrometheusRuleGroupPrometheusRuleGroup) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules-extensions.pkg.apis.rulesextensions.v0alpha1.PrometheusRuleGroupPrometheusRuleGroup"
}

// +k8s:openapi-gen=true
type PrometheusRuleGroupPromDuration string

// +k8s:openapi-gen=true
type PrometheusRuleGroupRuleEntry struct {
	Expr          string                           `json:"expr"`
	For           *PrometheusRuleGroupPromDuration `json:"for,omitempty"`
	KeepFiringFor *PrometheusRuleGroupPromDuration `json:"keepFiringFor,omitempty"`
	Labels        map[string]string                `json:"labels,omitempty"`
	Annotations   map[string]string                `json:"annotations,omitempty"`
	Record        *string                          `json:"record,omitempty"`
	Alert         *string                          `json:"alert,omitempty"`
}

// NewPrometheusRuleGroupRuleEntry creates a new PrometheusRuleGroupRuleEntry object.
func NewPrometheusRuleGroupRuleEntry() *PrometheusRuleGroupRuleEntry {
	return &PrometheusRuleGroupRuleEntry{}
}

// OpenAPIModelName returns the OpenAPI model name for PrometheusRuleGroupRuleEntry.
func (PrometheusRuleGroupRuleEntry) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules-extensions.pkg.apis.rulesextensions.v0alpha1.PrometheusRuleGroupRuleEntry"
}

// +k8s:openapi-gen=true
type PrometheusRuleGroupSpec struct {
	Groups []PrometheusRuleGroupPrometheusRuleGroup `json:"groups"`
}

// NewPrometheusRuleGroupSpec creates a new PrometheusRuleGroupSpec object.
func NewPrometheusRuleGroupSpec() *PrometheusRuleGroupSpec {
	return &PrometheusRuleGroupSpec{
		Groups: []PrometheusRuleGroupPrometheusRuleGroup{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for PrometheusRuleGroupSpec.
func (PrometheusRuleGroupSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules-extensions.pkg.apis.rulesextensions.v0alpha1.PrometheusRuleGroupSpec"
}

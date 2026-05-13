// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PrometheusRulePrometheusRuleGroup struct {
	Name        string                              `json:"name"`
	Interval    *PrometheusRulePromDuration         `json:"interval,omitempty"`
	QueryOffset *PrometheusRulePromDuration         `json:"queryOffset,omitempty"`
	Limit       *int64                              `json:"limit,omitempty"`
	Labels      map[string]string                   `json:"labels,omitempty"`
	Rules       []PrometheusRulePrometheusRuleEntry `json:"rules"`
}

// NewPrometheusRulePrometheusRuleGroup creates a new PrometheusRulePrometheusRuleGroup object.
func NewPrometheusRulePrometheusRuleGroup() *PrometheusRulePrometheusRuleGroup {
	return &PrometheusRulePrometheusRuleGroup{
		Rules: []PrometheusRulePrometheusRuleEntry{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for PrometheusRulePrometheusRuleGroup.
func (PrometheusRulePrometheusRuleGroup) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.PrometheusRulePrometheusRuleGroup"
}

// +k8s:openapi-gen=true
type PrometheusRulePromDuration string

// +k8s:openapi-gen=true
type PrometheusRulePrometheusRuleEntry struct {
	Alert         *string                     `json:"alert,omitempty"`
	Record        *string                     `json:"record,omitempty"`
	Expr          string                      `json:"expr"`
	For           *PrometheusRulePromDuration `json:"for,omitempty"`
	KeepFiringFor *PrometheusRulePromDuration `json:"keepFiringFor,omitempty"`
	Labels        map[string]string           `json:"labels,omitempty"`
	Annotations   map[string]string           `json:"annotations,omitempty"`
}

// NewPrometheusRulePrometheusRuleEntry creates a new PrometheusRulePrometheusRuleEntry object.
func NewPrometheusRulePrometheusRuleEntry() *PrometheusRulePrometheusRuleEntry {
	return &PrometheusRulePrometheusRuleEntry{}
}

// OpenAPIModelName returns the OpenAPI model name for PrometheusRulePrometheusRuleEntry.
func (PrometheusRulePrometheusRuleEntry) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.PrometheusRulePrometheusRuleEntry"
}

// +k8s:openapi-gen=true
type PrometheusRuleSpec struct {
	Groups []PrometheusRulePrometheusRuleGroup `json:"groups"`
}

// NewPrometheusRuleSpec creates a new PrometheusRuleSpec object.
func NewPrometheusRuleSpec() *PrometheusRuleSpec {
	return &PrometheusRuleSpec{
		Groups: []PrometheusRulePrometheusRuleGroup{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for PrometheusRuleSpec.
func (PrometheusRuleSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.PrometheusRuleSpec"
}

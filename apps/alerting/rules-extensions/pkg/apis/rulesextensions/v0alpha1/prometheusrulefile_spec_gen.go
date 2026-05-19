// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PrometheusRuleFileDatasourceUID string

// +k8s:openapi-gen=true
type PrometheusRuleFilePrometheusRuleGroup struct {
	Name        string                          `json:"name"`
	Interval    *PrometheusRuleFilePromDuration `json:"interval,omitempty"`
	QueryOffset *PrometheusRuleFilePromDuration `json:"queryOffset,omitempty"`
	Limit       *int64                          `json:"limit,omitempty"`
	Labels      map[string]string               `json:"labels,omitempty"`
	Rules       []PrometheusRuleFileRuleEntry   `json:"rules"`
}

// NewPrometheusRuleFilePrometheusRuleGroup creates a new PrometheusRuleFilePrometheusRuleGroup object.
func NewPrometheusRuleFilePrometheusRuleGroup() *PrometheusRuleFilePrometheusRuleGroup {
	return &PrometheusRuleFilePrometheusRuleGroup{
		Rules: []PrometheusRuleFileRuleEntry{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for PrometheusRuleFilePrometheusRuleGroup.
func (PrometheusRuleFilePrometheusRuleGroup) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules-extensions.pkg.apis.rulesextensions.v0alpha1.PrometheusRuleFilePrometheusRuleGroup"
}

// +k8s:openapi-gen=true
type PrometheusRuleFilePromDuration string

// +k8s:openapi-gen=true
type PrometheusRuleFileRuleEntry struct {
	Expr          string                          `json:"expr"`
	For           *PrometheusRuleFilePromDuration `json:"for,omitempty"`
	KeepFiringFor *PrometheusRuleFilePromDuration `json:"keepFiringFor,omitempty"`
	Labels        map[string]string               `json:"labels,omitempty"`
	Annotations   map[string]string               `json:"annotations,omitempty"`
	Record        *string                         `json:"record,omitempty"`
	Alert         *string                         `json:"alert,omitempty"`
}

// NewPrometheusRuleFileRuleEntry creates a new PrometheusRuleFileRuleEntry object.
func NewPrometheusRuleFileRuleEntry() *PrometheusRuleFileRuleEntry {
	return &PrometheusRuleFileRuleEntry{}
}

// OpenAPIModelName returns the OpenAPI model name for PrometheusRuleFileRuleEntry.
func (PrometheusRuleFileRuleEntry) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules-extensions.pkg.apis.rulesextensions.v0alpha1.PrometheusRuleFileRuleEntry"
}

// +k8s:openapi-gen=true
type PrometheusRuleFileSpec struct {
	DatasourceUID *PrometheusRuleFileDatasourceUID        `json:"datasourceUID,omitempty"`
	Groups        []PrometheusRuleFilePrometheusRuleGroup `json:"groups"`
}

// NewPrometheusRuleFileSpec creates a new PrometheusRuleFileSpec object.
func NewPrometheusRuleFileSpec() *PrometheusRuleFileSpec {
	return &PrometheusRuleFileSpec{
		Groups: []PrometheusRuleFilePrometheusRuleGroup{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for PrometheusRuleFileSpec.
func (PrometheusRuleFileSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules-extensions.pkg.apis.rulesextensions.v0alpha1.PrometheusRuleFileSpec"
}

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PrometheusSpec struct {
	Name string `json:"name"`
	Url  string `json:"url"`
}

// NewPrometheusSpec creates a new PrometheusSpec object.
func NewPrometheusSpec() *PrometheusSpec {
	return &PrometheusSpec{}
}

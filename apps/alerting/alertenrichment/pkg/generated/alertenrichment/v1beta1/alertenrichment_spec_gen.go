// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// TODO: replace with the full AlertEnrichmentSpec.
// +k8s:openapi-gen=true
type AlertEnrichmentSpec struct {
	Title string `json:"title"`
}

// NewAlertEnrichmentSpec creates a new AlertEnrichmentSpec object.
func NewAlertEnrichmentSpec() *AlertEnrichmentSpec {
	return &AlertEnrichmentSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentSpec.
func (AlertEnrichmentSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.generated.alertenrichment.v1beta1.AlertEnrichmentSpec"
}

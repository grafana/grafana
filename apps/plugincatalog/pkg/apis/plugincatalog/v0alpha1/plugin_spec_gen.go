// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PluginSpec struct {
	// Slug is the plugin identifier (e.g., "grafana-clock-panel")
	Slug string `json:"slug"`
	// Status is the plugin status from grafana.com ("active" or "enterprise")
	Status string `json:"status"`
	// SignatureType is the plugin signature type
	SignatureType string `json:"signatureType"`
}

// NewPluginSpec creates a new PluginSpec object.
func NewPluginSpec() *PluginSpec {
	return &PluginSpec{}
}

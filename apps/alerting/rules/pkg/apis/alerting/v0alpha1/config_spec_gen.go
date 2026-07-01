// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ConfigSpec struct {
	ExternalRulerSync *ConfigV0alpha1SpecExternalRulerSync `json:"externalRulerSync,omitempty"`
}

// NewConfigSpec creates a new ConfigSpec object.
func NewConfigSpec() *ConfigSpec {
	return &ConfigSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for ConfigSpec.
func (ConfigSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ConfigSpec"
}

// +k8s:openapi-gen=true
type ConfigV0alpha1SpecExternalRulerSync struct {
	// datasourceUid is the UID of the Mimir/Cortex Prometheus datasource to
	// sync alert rules from. Empty means no sync is configured for the current
	// org. The operator ini setting `unified_alerting.external_ruler_uid`
	// overrides this when set; see status.externalRulerSync.origin.
	DatasourceUid *string `json:"datasourceUid,omitempty"`
}

// NewConfigV0alpha1SpecExternalRulerSync creates a new ConfigV0alpha1SpecExternalRulerSync object.
func NewConfigV0alpha1SpecExternalRulerSync() *ConfigV0alpha1SpecExternalRulerSync {
	return &ConfigV0alpha1SpecExternalRulerSync{}
}

// OpenAPIModelName returns the OpenAPI model name for ConfigV0alpha1SpecExternalRulerSync.
func (ConfigV0alpha1SpecExternalRulerSync) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ConfigV0alpha1SpecExternalRulerSync"
}

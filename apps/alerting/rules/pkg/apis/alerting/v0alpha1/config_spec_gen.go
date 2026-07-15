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
	// targetDatasourceUid is the UID of the datasource that converted recording
	// rules write their results to. Empty defaults to datasourceUid (the query
	// datasource). Only used when the upstream ruler contains recording rules.
	TargetDatasourceUid *string `json:"targetDatasourceUid,omitempty"`
	// promote, when true, converts the rules already synced from datasourceUid
	// into native Grafana rules the org owns (provenance is cleared so they
	// become editable) and stops syncing them. This is a one-way action: once
	// promoted the worker no longer manages these rules. Ignored while the
	// operator ini override `unified_alerting.external_ruler_uid` is set.
	Promote *bool `json:"promote,omitempty"`
}

// NewConfigV0alpha1SpecExternalRulerSync creates a new ConfigV0alpha1SpecExternalRulerSync object.
func NewConfigV0alpha1SpecExternalRulerSync() *ConfigV0alpha1SpecExternalRulerSync {
	return &ConfigV0alpha1SpecExternalRulerSync{}
}

// OpenAPIModelName returns the OpenAPI model name for ConfigV0alpha1SpecExternalRulerSync.
func (ConfigV0alpha1SpecExternalRulerSync) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ConfigV0alpha1SpecExternalRulerSync"
}

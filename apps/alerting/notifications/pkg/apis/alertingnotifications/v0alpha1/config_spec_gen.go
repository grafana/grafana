// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ConfigSpec struct {
	ExternalAlertmanagerSync *ConfigV0alpha1SpecExternalAlertmanagerSync `json:"externalAlertmanagerSync,omitempty"`
}

// NewConfigSpec creates a new ConfigSpec object.
func NewConfigSpec() *ConfigSpec {
	return &ConfigSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for ConfigSpec.
func (ConfigSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.ConfigSpec"
}

// +k8s:openapi-gen=true
type ConfigV0alpha1SpecExternalAlertmanagerSync struct {
	// datasourceUid is the UID of the Mimir/Cortex Alertmanager datasource to
	// sync from. Empty means no sync is configured for the current org. The
	// operator ini setting `unified_alerting.external_alertmanager_uid`
	// overrides this when set; see status.externalAlertmanagerSync.origin.
	DatasourceUid *string `json:"datasourceUid,omitempty"`
}

// NewConfigV0alpha1SpecExternalAlertmanagerSync creates a new ConfigV0alpha1SpecExternalAlertmanagerSync object.
func NewConfigV0alpha1SpecExternalAlertmanagerSync() *ConfigV0alpha1SpecExternalAlertmanagerSync {
	return &ConfigV0alpha1SpecExternalAlertmanagerSync{}
}

// OpenAPIModelName returns the OpenAPI model name for ConfigV0alpha1SpecExternalAlertmanagerSync.
func (ConfigV0alpha1SpecExternalAlertmanagerSync) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.ConfigV0alpha1SpecExternalAlertmanagerSync"
}

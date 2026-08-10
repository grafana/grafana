// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type ConfigSpec struct {
	ExternalAlertmanagerSync *ConfigV1beta1SpecExternalAlertmanagerSync `json:"externalAlertmanagerSync,omitempty"`
}

// NewConfigSpec creates a new ConfigSpec object.
func NewConfigSpec() *ConfigSpec {
	return &ConfigSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for ConfigSpec.
func (ConfigSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ConfigSpec"
}

// +k8s:openapi-gen=true
type ConfigV1beta1SpecExternalAlertmanagerSync struct {
	// datasourceUid is the UID of the Mimir/Cortex Alertmanager datasource to
	// sync from. Empty means no sync is configured for the current org. The
	// operator ini setting `unified_alerting.external_alertmanager_uid`
	// overrides this when set; see status.externalAlertmanagerSync.origin.
	DatasourceUid *string `json:"datasourceUid,omitempty"`
}

// NewConfigV1beta1SpecExternalAlertmanagerSync creates a new ConfigV1beta1SpecExternalAlertmanagerSync object.
func NewConfigV1beta1SpecExternalAlertmanagerSync() *ConfigV1beta1SpecExternalAlertmanagerSync {
	return &ConfigV1beta1SpecExternalAlertmanagerSync{}
}

// OpenAPIModelName returns the OpenAPI model name for ConfigV1beta1SpecExternalAlertmanagerSync.
func (ConfigV1beta1SpecExternalAlertmanagerSync) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ConfigV1beta1SpecExternalAlertmanagerSync"
}

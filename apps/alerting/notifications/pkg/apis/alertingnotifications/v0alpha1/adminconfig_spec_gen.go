// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AdminConfigSpec struct {
	// externalAlertmanagerSync configures the per-org external Alertmanager
	// configuration sync worker. The worker periodically fetches the
	// alertmanager configuration from a Mimir/Cortex datasource and merges
	// it into the org's local alertmanager configuration.
	ExternalAlertmanagerSync *AdminConfigV0alpha1SpecExternalAlertmanagerSync `json:"externalAlertmanagerSync,omitempty"`
}

// NewAdminConfigSpec creates a new AdminConfigSpec object.
func NewAdminConfigSpec() *AdminConfigSpec {
	return &AdminConfigSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for AdminConfigSpec.
func (AdminConfigSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.AdminConfigSpec"
}

// +k8s:openapi-gen=true
type AdminConfigV0alpha1SpecExternalAlertmanagerSync struct {
	// datasourceUid is the UID of the Mimir/Cortex Alertmanager
	// datasource to sync from. Empty means no per-org sync configured.
	// The operator ini setting `unified_alerting.external_alertmanager_uid`
	// overrides this when set; see status.externalAlertmanagerSync.origin.
	DatasourceUid *string `json:"datasourceUid,omitempty"`
}

// NewAdminConfigV0alpha1SpecExternalAlertmanagerSync creates a new AdminConfigV0alpha1SpecExternalAlertmanagerSync object.
func NewAdminConfigV0alpha1SpecExternalAlertmanagerSync() *AdminConfigV0alpha1SpecExternalAlertmanagerSync {
	return &AdminConfigV0alpha1SpecExternalAlertmanagerSync{}
}

// OpenAPIModelName returns the OpenAPI model name for AdminConfigV0alpha1SpecExternalAlertmanagerSync.
func (AdminConfigV0alpha1SpecExternalAlertmanagerSync) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.AdminConfigV0alpha1SpecExternalAlertmanagerSync"
}

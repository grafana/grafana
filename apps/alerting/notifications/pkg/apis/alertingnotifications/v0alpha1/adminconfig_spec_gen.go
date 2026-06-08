// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// AlertmanagerSpec groups admin config for the current org's Alertmanager.
// +k8s:openapi-gen=true
type AdminConfigAlertmanagerSpec struct {
	// externalSync configures syncing the Alertmanager configuration from a
	// Mimir/Cortex datasource into the current org. The worker periodically
	// fetches the upstream configuration and merges it into the current org's
	// Grafana alertmanager configuration.
	ExternalSync *AdminConfigV0alpha1AlertmanagerSpecExternalSync `json:"externalSync,omitempty"`
}

// NewAdminConfigAlertmanagerSpec creates a new AdminConfigAlertmanagerSpec object.
func NewAdminConfigAlertmanagerSpec() *AdminConfigAlertmanagerSpec {
	return &AdminConfigAlertmanagerSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for AdminConfigAlertmanagerSpec.
func (AdminConfigAlertmanagerSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.AdminConfigAlertmanagerSpec"
}

// +k8s:openapi-gen=true
type AdminConfigSpec struct {
	// alertmanager groups admin config for the current org's Alertmanager.
	Alertmanager *AdminConfigAlertmanagerSpec `json:"alertmanager,omitempty"`
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
type AdminConfigV0alpha1AlertmanagerSpecExternalSync struct {
	// datasourceUid is the UID of the Mimir/Cortex Alertmanager datasource
	// to sync from. Empty means no sync is configured for the current org.
	// The operator ini setting `unified_alerting.external_alertmanager_uid`
	// overrides this when set; see status.alertmanager.externalSync.origin.
	DatasourceUid *string `json:"datasourceUid,omitempty"`
}

// NewAdminConfigV0alpha1AlertmanagerSpecExternalSync creates a new AdminConfigV0alpha1AlertmanagerSpecExternalSync object.
func NewAdminConfigV0alpha1AlertmanagerSpecExternalSync() *AdminConfigV0alpha1AlertmanagerSpecExternalSync {
	return &AdminConfigV0alpha1AlertmanagerSpecExternalSync{}
}

// OpenAPIModelName returns the OpenAPI model name for AdminConfigV0alpha1AlertmanagerSpecExternalSync.
func (AdminConfigV0alpha1AlertmanagerSpecExternalSync) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.AdminConfigV0alpha1AlertmanagerSpecExternalSync"
}

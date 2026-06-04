// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AlertingConfigSpec struct {
	// externalAlertmanagerSync configures the per-org external Alertmanager
	// configuration sync worker. The worker fetches the alertmanager
	// configuration from a Mimir/Cortex datasource and merges it into the
	// org's local alertmanager configuration on each MAM sync tick.
	ExternalAlertmanagerSync *AlertingConfigV0alpha1SpecExternalAlertmanagerSync `json:"externalAlertmanagerSync,omitempty"`
}

// NewAlertingConfigSpec creates a new AlertingConfigSpec object.
func NewAlertingConfigSpec() *AlertingConfigSpec {
	return &AlertingConfigSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertingConfigSpec.
func (AlertingConfigSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.admin.pkg.apis.alertingadmin.v0alpha1.AlertingConfigSpec"
}

// +k8s:openapi-gen=true
type AlertingConfigV0alpha1SpecExternalAlertmanagerSync struct {
	// datasourceUid is the UID of the Mimir/Cortex Alertmanager
	// datasource to sync configuration from. Empty (omitted) means
	// no per-org sync is configured. The operator-level
	// unified_alerting.external_alertmanager_uid ini setting still
	// wins over this when set — runtime observation of which source
	// is active lives on the status sub-object (origin field).
	DatasourceUid *string `json:"datasourceUid,omitempty"`
}

// NewAlertingConfigV0alpha1SpecExternalAlertmanagerSync creates a new AlertingConfigV0alpha1SpecExternalAlertmanagerSync object.
func NewAlertingConfigV0alpha1SpecExternalAlertmanagerSync() *AlertingConfigV0alpha1SpecExternalAlertmanagerSync {
	return &AlertingConfigV0alpha1SpecExternalAlertmanagerSync{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertingConfigV0alpha1SpecExternalAlertmanagerSync.
func (AlertingConfigV0alpha1SpecExternalAlertmanagerSync) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.admin.pkg.apis.alertingadmin.v0alpha1.AlertingConfigV0alpha1SpecExternalAlertmanagerSync"
}

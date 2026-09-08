// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// Condition mirrors metav1.Condition. Inlined because the app-sdk codegen
// here can't reference metav1.Condition from CUE. Field semantics are
// k8s-standard; reason values are produced by SyncReason in the syncer.
// +k8s:openapi-gen=true
type ConfigCondition struct {
	Type   string                `json:"type"`
	Status ConfigConditionStatus `json:"status"`
	// RFC3339
	LastTransitionTime string  `json:"lastTransitionTime"`
	Reason             string  `json:"reason"`
	Message            *string `json:"message,omitempty"`
	ObservedGeneration *int64  `json:"observedGeneration,omitempty"`
}

// NewConfigCondition creates a new ConfigCondition object.
func NewConfigCondition() *ConfigCondition {
	return &ConfigCondition{}
}

// OpenAPIModelName returns the OpenAPI model name for ConfigCondition.
func (ConfigCondition) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ConfigCondition"
}

// +k8s:openapi-gen=true
type ConfigStatus struct {
	// observedGeneration is the spec.generation last evaluated by the
	// controllers writing this status.
	ObservedGeneration       *int64                                       `json:"observedGeneration,omitempty"`
	ExternalAlertmanagerSync *ConfigV1beta1StatusExternalAlertmanagerSync `json:"externalAlertmanagerSync,omitempty"`
	// Standard k8s-style condition list. Each binary-state feature owns one
	// condition type. Current types:
	//   - ExternalAlertmanagerSynced: True after a successful sync, False
	//     after a failed attempt, Unknown until the first attempt.
	Conditions []ConfigCondition `json:"conditions,omitempty"`
}

// NewConfigStatus creates a new ConfigStatus object.
func NewConfigStatus() *ConfigStatus {
	return &ConfigStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for ConfigStatus.
func (ConfigStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ConfigStatus"
}

// +k8s:openapi-gen=true
type ConfigV1beta1StatusExternalAlertmanagerSync struct {
	// datasourceUid is the UID actually used on the last sync attempt; may lag
	// spec until the next tick. When origin=ini, this is the ini override value.
	DatasourceUid *string `json:"datasourceUid,omitempty"`
	// origin records which source supplied datasourceUid on the last run. "ini"
	// (grafana.ini's unified_alerting.external_alertmanager_uid) wins over "api"
	// (spec.externalAlertmanagerSync.datasourceUid).
	Origin *ConfigV1beta1StatusExternalAlertmanagerSyncOrigin `json:"origin,omitempty"`
}

// NewConfigV1beta1StatusExternalAlertmanagerSync creates a new ConfigV1beta1StatusExternalAlertmanagerSync object.
func NewConfigV1beta1StatusExternalAlertmanagerSync() *ConfigV1beta1StatusExternalAlertmanagerSync {
	return &ConfigV1beta1StatusExternalAlertmanagerSync{}
}

// OpenAPIModelName returns the OpenAPI model name for ConfigV1beta1StatusExternalAlertmanagerSync.
func (ConfigV1beta1StatusExternalAlertmanagerSync) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ConfigV1beta1StatusExternalAlertmanagerSync"
}

// +k8s:openapi-gen=true
type ConfigConditionStatus string

const (
	ConfigConditionStatusTrue    ConfigConditionStatus = "True"
	ConfigConditionStatusFalse   ConfigConditionStatus = "False"
	ConfigConditionStatusUnknown ConfigConditionStatus = "Unknown"
)

// OpenAPIModelName returns the OpenAPI model name for ConfigConditionStatus.
func (ConfigConditionStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ConfigConditionStatus"
}

// +k8s:openapi-gen=true
type ConfigV1beta1StatusExternalAlertmanagerSyncOrigin string

const (
	ConfigV1beta1StatusExternalAlertmanagerSyncOriginApi ConfigV1beta1StatusExternalAlertmanagerSyncOrigin = "api"
	ConfigV1beta1StatusExternalAlertmanagerSyncOriginIni ConfigV1beta1StatusExternalAlertmanagerSyncOrigin = "ini"
)

// OpenAPIModelName returns the OpenAPI model name for ConfigV1beta1StatusExternalAlertmanagerSyncOrigin.
func (ConfigV1beta1StatusExternalAlertmanagerSyncOrigin) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v1beta1.ConfigV1beta1StatusExternalAlertmanagerSyncOrigin"
}

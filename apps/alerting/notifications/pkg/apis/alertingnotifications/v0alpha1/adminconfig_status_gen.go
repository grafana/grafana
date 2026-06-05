// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// Condition mirrors metav1.Condition. Inlined because the app-sdk codegen
// here can't reference metav1.Condition from CUE. Field semantics are
// k8s-standard; reason values are produced by SyncReason in the syncer.
// +k8s:openapi-gen=true
type AdminConfigCondition struct {
	Type   string                     `json:"type"`
	Status AdminConfigConditionStatus `json:"status"`
	// RFC3339
	LastTransitionTime string  `json:"lastTransitionTime"`
	Reason             string  `json:"reason"`
	Message            *string `json:"message,omitempty"`
	ObservedGeneration *int64  `json:"observedGeneration,omitempty"`
}

// NewAdminConfigCondition creates a new AdminConfigCondition object.
func NewAdminConfigCondition() *AdminConfigCondition {
	return &AdminConfigCondition{}
}

// OpenAPIModelName returns the OpenAPI model name for AdminConfigCondition.
func (AdminConfigCondition) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.AdminConfigCondition"
}

// +k8s:openapi-gen=true
type AdminConfigStatus struct {
	// observedGeneration is the spec.generation last evaluated by the
	// controllers writing this status.
	ObservedGeneration *int64 `json:"observedGeneration,omitempty"`
	// externalAlertmanagerSync mirrors the spec sub-object with runtime
	// observation. Conditions for this feature live at
	// .status.conditions[type=ExternalAlertmanagerSynced].
	ExternalAlertmanagerSync *AdminConfigV0alpha1StatusExternalAlertmanagerSync `json:"externalAlertmanagerSync,omitempty"`
	// Standard k8s-style condition list. Each binary-state feature owns one
	// condition type. Current types:
	//   - ExternalAlertmanagerSynced: True after a successful sync, False
	//     after a failed attempt, Unknown until the first attempt.
	Conditions []AdminConfigCondition `json:"conditions,omitempty"`
}

// NewAdminConfigStatus creates a new AdminConfigStatus object.
func NewAdminConfigStatus() *AdminConfigStatus {
	return &AdminConfigStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for AdminConfigStatus.
func (AdminConfigStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.AdminConfigStatus"
}

// +k8s:openapi-gen=true
type AdminConfigV0alpha1StatusExternalAlertmanagerSync struct {
	// datasourceUid is the UID actually used on the last sync attempt;
	// may lag spec until the next tick. When origin=ini, this is the
	// ini override value.
	DatasourceUid *string `json:"datasourceUid,omitempty"`
	// origin records which source supplied datasourceUid on the last run.
	// "ini" (grafana.ini's unified_alerting.external_alertmanager_uid)
	// wins over "api" (spec.externalAlertmanagerSync.datasourceUid).
	Origin *AdminConfigV0alpha1StatusExternalAlertmanagerSyncOrigin `json:"origin,omitempty"`
}

// NewAdminConfigV0alpha1StatusExternalAlertmanagerSync creates a new AdminConfigV0alpha1StatusExternalAlertmanagerSync object.
func NewAdminConfigV0alpha1StatusExternalAlertmanagerSync() *AdminConfigV0alpha1StatusExternalAlertmanagerSync {
	return &AdminConfigV0alpha1StatusExternalAlertmanagerSync{}
}

// OpenAPIModelName returns the OpenAPI model name for AdminConfigV0alpha1StatusExternalAlertmanagerSync.
func (AdminConfigV0alpha1StatusExternalAlertmanagerSync) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.AdminConfigV0alpha1StatusExternalAlertmanagerSync"
}

// +k8s:openapi-gen=true
type AdminConfigConditionStatus string

const (
	AdminConfigConditionStatusTrue    AdminConfigConditionStatus = "True"
	AdminConfigConditionStatusFalse   AdminConfigConditionStatus = "False"
	AdminConfigConditionStatusUnknown AdminConfigConditionStatus = "Unknown"
)

// OpenAPIModelName returns the OpenAPI model name for AdminConfigConditionStatus.
func (AdminConfigConditionStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.AdminConfigConditionStatus"
}

// +k8s:openapi-gen=true
type AdminConfigV0alpha1StatusExternalAlertmanagerSyncOrigin string

const (
	AdminConfigV0alpha1StatusExternalAlertmanagerSyncOriginApi AdminConfigV0alpha1StatusExternalAlertmanagerSyncOrigin = "api"
	AdminConfigV0alpha1StatusExternalAlertmanagerSyncOriginIni AdminConfigV0alpha1StatusExternalAlertmanagerSyncOrigin = "ini"
)

// OpenAPIModelName returns the OpenAPI model name for AdminConfigV0alpha1StatusExternalAlertmanagerSyncOrigin.
func (AdminConfigV0alpha1StatusExternalAlertmanagerSyncOrigin) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.AdminConfigV0alpha1StatusExternalAlertmanagerSyncOrigin"
}

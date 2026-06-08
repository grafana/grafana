// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// AlertmanagerStatus mirrors #AlertmanagerSpec with runtime observation.
// +k8s:openapi-gen=true
type AdminConfigAlertmanagerStatus struct {
	ExternalSync *AdminConfigV0alpha1AlertmanagerStatusExternalSync `json:"externalSync,omitempty"`
}

// NewAdminConfigAlertmanagerStatus creates a new AdminConfigAlertmanagerStatus object.
func NewAdminConfigAlertmanagerStatus() *AdminConfigAlertmanagerStatus {
	return &AdminConfigAlertmanagerStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for AdminConfigAlertmanagerStatus.
func (AdminConfigAlertmanagerStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.AdminConfigAlertmanagerStatus"
}

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
	// alertmanager mirrors spec.alertmanager with runtime observation.
	Alertmanager *AdminConfigAlertmanagerStatus `json:"alertmanager,omitempty"`
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
type AdminConfigV0alpha1AlertmanagerStatusExternalSync struct {
	// datasourceUid is the UID actually used on the last sync attempt; may
	// lag spec until the next tick. When origin=ini, this is the ini
	// override value.
	DatasourceUid *string `json:"datasourceUid,omitempty"`
	// origin records which source supplied datasourceUid on the last run.
	// "ini" (grafana.ini's unified_alerting.external_alertmanager_uid) wins
	// over "api" (spec.alertmanager.externalSync.datasourceUid).
	Origin *AdminConfigV0alpha1AlertmanagerStatusExternalSyncOrigin `json:"origin,omitempty"`
}

// NewAdminConfigV0alpha1AlertmanagerStatusExternalSync creates a new AdminConfigV0alpha1AlertmanagerStatusExternalSync object.
func NewAdminConfigV0alpha1AlertmanagerStatusExternalSync() *AdminConfigV0alpha1AlertmanagerStatusExternalSync {
	return &AdminConfigV0alpha1AlertmanagerStatusExternalSync{}
}

// OpenAPIModelName returns the OpenAPI model name for AdminConfigV0alpha1AlertmanagerStatusExternalSync.
func (AdminConfigV0alpha1AlertmanagerStatusExternalSync) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.AdminConfigV0alpha1AlertmanagerStatusExternalSync"
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
type AdminConfigV0alpha1AlertmanagerStatusExternalSyncOrigin string

const (
	AdminConfigV0alpha1AlertmanagerStatusExternalSyncOriginApi AdminConfigV0alpha1AlertmanagerStatusExternalSyncOrigin = "api"
	AdminConfigV0alpha1AlertmanagerStatusExternalSyncOriginIni AdminConfigV0alpha1AlertmanagerStatusExternalSyncOrigin = "ini"
)

// OpenAPIModelName returns the OpenAPI model name for AdminConfigV0alpha1AlertmanagerStatusExternalSyncOrigin.
func (AdminConfigV0alpha1AlertmanagerStatusExternalSyncOrigin) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.AdminConfigV0alpha1AlertmanagerStatusExternalSyncOrigin"
}

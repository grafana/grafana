// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AlertingConfigstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State AlertingConfigStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewAlertingConfigstatusOperatorState creates a new AlertingConfigstatusOperatorState object.
func NewAlertingConfigstatusOperatorState() *AlertingConfigstatusOperatorState {
	return &AlertingConfigstatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertingConfigstatusOperatorState.
func (AlertingConfigstatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.admin.pkg.apis.alertingadmin.v0alpha1.AlertingConfigstatusOperatorState"
}

// Condition mirrors metav1.Condition. Inlined because the app-sdk codegen
// here can't reference metav1.Condition from CUE. Field semantics are
// k8s-standard; reason values are produced by SyncReason in the syncer.
// +k8s:openapi-gen=true
type AlertingConfigCondition struct {
	Type   string                        `json:"type"`
	Status AlertingConfigConditionStatus `json:"status"`
	// RFC3339
	LastTransitionTime string  `json:"lastTransitionTime"`
	Reason             string  `json:"reason"`
	Message            *string `json:"message,omitempty"`
	ObservedGeneration *int64  `json:"observedGeneration,omitempty"`
}

// NewAlertingConfigCondition creates a new AlertingConfigCondition object.
func NewAlertingConfigCondition() *AlertingConfigCondition {
	return &AlertingConfigCondition{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertingConfigCondition.
func (AlertingConfigCondition) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.admin.pkg.apis.alertingadmin.v0alpha1.AlertingConfigCondition"
}

// +k8s:openapi-gen=true
type AlertingConfigStatus struct {
	// observedGeneration is the spec.generation last evaluated by the
	// controllers writing this status.
	ObservedGeneration *int64 `json:"observedGeneration,omitempty"`
	// externalAlertmanagerSync mirrors the spec sub-object with runtime
	// observation. Conditions for this feature live at
	// .status.conditions[type=ExternalAlertmanagerSynced].
	ExternalAlertmanagerSync *AlertingConfigV0alpha1StatusExternalAlertmanagerSync `json:"externalAlertmanagerSync,omitempty"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]AlertingConfigstatusOperatorState `json:"operatorStates,omitempty"`
	// Standard k8s-style condition list. Each binary-state feature owns one
	// condition type. Current types:
	//   - ExternalAlertmanagerSynced: True after a successful sync, False
	//     after a failed attempt, Unknown until the first attempt.
	Conditions []AlertingConfigCondition `json:"conditions,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewAlertingConfigStatus creates a new AlertingConfigStatus object.
func NewAlertingConfigStatus() *AlertingConfigStatus {
	return &AlertingConfigStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertingConfigStatus.
func (AlertingConfigStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.admin.pkg.apis.alertingadmin.v0alpha1.AlertingConfigStatus"
}

// +k8s:openapi-gen=true
type AlertingConfigV0alpha1StatusExternalAlertmanagerSync struct {
	// datasourceUid is the UID actually used on the last sync attempt;
	// may lag spec until the next tick. When origin=ini, this is the
	// ini override value.
	DatasourceUid *string `json:"datasourceUid,omitempty"`
	// origin records which source supplied datasourceUid on the last run.
	// "ini" (grafana.ini's unified_alerting.external_alertmanager_uid)
	// wins over "api" (spec.externalAlertmanagerSync.datasourceUid).
	Origin *AlertingConfigV0alpha1StatusExternalAlertmanagerSyncOrigin `json:"origin,omitempty"`
}

// NewAlertingConfigV0alpha1StatusExternalAlertmanagerSync creates a new AlertingConfigV0alpha1StatusExternalAlertmanagerSync object.
func NewAlertingConfigV0alpha1StatusExternalAlertmanagerSync() *AlertingConfigV0alpha1StatusExternalAlertmanagerSync {
	return &AlertingConfigV0alpha1StatusExternalAlertmanagerSync{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertingConfigV0alpha1StatusExternalAlertmanagerSync.
func (AlertingConfigV0alpha1StatusExternalAlertmanagerSync) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.admin.pkg.apis.alertingadmin.v0alpha1.AlertingConfigV0alpha1StatusExternalAlertmanagerSync"
}

// +k8s:openapi-gen=true
type AlertingConfigStatusOperatorStateState string

const (
	AlertingConfigStatusOperatorStateStateSuccess    AlertingConfigStatusOperatorStateState = "success"
	AlertingConfigStatusOperatorStateStateInProgress AlertingConfigStatusOperatorStateState = "in_progress"
	AlertingConfigStatusOperatorStateStateFailed     AlertingConfigStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for AlertingConfigStatusOperatorStateState.
func (AlertingConfigStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.admin.pkg.apis.alertingadmin.v0alpha1.AlertingConfigStatusOperatorStateState"
}

// +k8s:openapi-gen=true
type AlertingConfigConditionStatus string

const (
	AlertingConfigConditionStatusTrue    AlertingConfigConditionStatus = "True"
	AlertingConfigConditionStatusFalse   AlertingConfigConditionStatus = "False"
	AlertingConfigConditionStatusUnknown AlertingConfigConditionStatus = "Unknown"
)

// OpenAPIModelName returns the OpenAPI model name for AlertingConfigConditionStatus.
func (AlertingConfigConditionStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.admin.pkg.apis.alertingadmin.v0alpha1.AlertingConfigConditionStatus"
}

// +k8s:openapi-gen=true
type AlertingConfigV0alpha1StatusExternalAlertmanagerSyncOrigin string

const (
	AlertingConfigV0alpha1StatusExternalAlertmanagerSyncOriginApi AlertingConfigV0alpha1StatusExternalAlertmanagerSyncOrigin = "api"
	AlertingConfigV0alpha1StatusExternalAlertmanagerSyncOriginIni AlertingConfigV0alpha1StatusExternalAlertmanagerSyncOrigin = "ini"
)

// OpenAPIModelName returns the OpenAPI model name for AlertingConfigV0alpha1StatusExternalAlertmanagerSyncOrigin.
func (AlertingConfigV0alpha1StatusExternalAlertmanagerSyncOrigin) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.admin.pkg.apis.alertingadmin.v0alpha1.AlertingConfigV0alpha1StatusExternalAlertmanagerSyncOrigin"
}

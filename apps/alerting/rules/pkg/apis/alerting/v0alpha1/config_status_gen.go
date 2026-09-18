// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ConfigstatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State ConfigStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewConfigstatusOperatorState creates a new ConfigstatusOperatorState object.
func NewConfigstatusOperatorState() *ConfigstatusOperatorState {
	return &ConfigstatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for ConfigstatusOperatorState.
func (ConfigstatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ConfigstatusOperatorState"
}

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
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ConfigCondition"
}

// +k8s:openapi-gen=true
type ConfigStatus struct {
	// observedGeneration is the spec.generation last evaluated by the
	// controllers writing this status.
	ObservedGeneration *int64                                 `json:"observedGeneration,omitempty"`
	ExternalRulerSync  *ConfigV0alpha1StatusExternalRulerSync `json:"externalRulerSync,omitempty"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]ConfigstatusOperatorState `json:"operatorStates,omitempty"`
	// Standard k8s-style condition list. Each binary-state feature owns one
	// condition type. Current types:
	//   - ExternalRulerSynced: True after a successful sync, False after a
	//     failed attempt, Unknown until the first attempt.
	Conditions []ConfigCondition `json:"conditions,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewConfigStatus creates a new ConfigStatus object.
func NewConfigStatus() *ConfigStatus {
	return &ConfigStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for ConfigStatus.
func (ConfigStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ConfigStatus"
}

// +k8s:openapi-gen=true
type ConfigV0alpha1StatusExternalRulerSync struct {
	// datasourceUid is the UID actually used on the last sync attempt; may lag
	// spec until the next tick. When origin=ini, this is the ini override value.
	DatasourceUid *string `json:"datasourceUid,omitempty"`
	// origin records which source supplied datasourceUid on the last run. "ini"
	// (grafana.ini's unified_alerting.external_ruler_uid) wins over "api"
	// (spec.externalRulerSync.datasourceUid).
	Origin *ConfigV0alpha1StatusExternalRulerSyncOrigin `json:"origin,omitempty"`
}

// NewConfigV0alpha1StatusExternalRulerSync creates a new ConfigV0alpha1StatusExternalRulerSync object.
func NewConfigV0alpha1StatusExternalRulerSync() *ConfigV0alpha1StatusExternalRulerSync {
	return &ConfigV0alpha1StatusExternalRulerSync{}
}

// OpenAPIModelName returns the OpenAPI model name for ConfigV0alpha1StatusExternalRulerSync.
func (ConfigV0alpha1StatusExternalRulerSync) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ConfigV0alpha1StatusExternalRulerSync"
}

// +k8s:openapi-gen=true
type ConfigStatusOperatorStateState string

const (
	ConfigStatusOperatorStateStateSuccess    ConfigStatusOperatorStateState = "success"
	ConfigStatusOperatorStateStateInProgress ConfigStatusOperatorStateState = "in_progress"
	ConfigStatusOperatorStateStateFailed     ConfigStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for ConfigStatusOperatorStateState.
func (ConfigStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ConfigStatusOperatorStateState"
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
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ConfigConditionStatus"
}

// +k8s:openapi-gen=true
type ConfigV0alpha1StatusExternalRulerSyncOrigin string

const (
	ConfigV0alpha1StatusExternalRulerSyncOriginApi ConfigV0alpha1StatusExternalRulerSyncOrigin = "api"
	ConfigV0alpha1StatusExternalRulerSyncOriginIni ConfigV0alpha1StatusExternalRulerSyncOrigin = "ini"
)

// OpenAPIModelName returns the OpenAPI model name for ConfigV0alpha1StatusExternalRulerSyncOrigin.
func (ConfigV0alpha1StatusExternalRulerSyncOrigin) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.ConfigV0alpha1StatusExternalRulerSyncOrigin"
}

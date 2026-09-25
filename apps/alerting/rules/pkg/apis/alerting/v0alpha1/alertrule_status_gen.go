// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	time "time"
)

// +k8s:openapi-gen=true
type AlertRuleAlertRuleHealth string

const (
	AlertRuleAlertRuleHealthUnknown AlertRuleAlertRuleHealth = "Unknown"
	AlertRuleAlertRuleHealthOK      AlertRuleAlertRuleHealth = "OK"
	AlertRuleAlertRuleHealthPaused  AlertRuleAlertRuleHealth = "Paused"
	AlertRuleAlertRuleHealthError   AlertRuleAlertRuleHealth = "Error"
	AlertRuleAlertRuleHealthNoData  AlertRuleAlertRuleHealth = "NoData"
)

// OpenAPIModelName returns the OpenAPI model name for AlertRuleAlertRuleHealth.
func (AlertRuleAlertRuleHealth) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRuleAlertRuleHealth"
}

// +k8s:openapi-gen=true
type AlertRuleAlertRuleState string

const (
	AlertRuleAlertRuleStateInactive   AlertRuleAlertRuleState = "Inactive"
	AlertRuleAlertRuleStateHealthy    AlertRuleAlertRuleState = "Healthy"
	AlertRuleAlertRuleStateFiring     AlertRuleAlertRuleState = "Firing"
	AlertRuleAlertRuleStatePending    AlertRuleAlertRuleState = "Pending"
	AlertRuleAlertRuleStateRecovering AlertRuleAlertRuleState = "Recovering"
)

// OpenAPIModelName returns the OpenAPI model name for AlertRuleAlertRuleState.
func (AlertRuleAlertRuleState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRuleAlertRuleState"
}

// +k8s:openapi-gen=true
type AlertRuleAlertRuleStateReason string

const (
	AlertRuleAlertRuleStateReasonEvaluated AlertRuleAlertRuleStateReason = "Evaluated"
	AlertRuleAlertRuleStateReasonKeepLast  AlertRuleAlertRuleStateReason = "KeepLast"
)

// OpenAPIModelName returns the OpenAPI model name for AlertRuleAlertRuleStateReason.
func (AlertRuleAlertRuleStateReason) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRuleAlertRuleStateReason"
}

// +k8s:openapi-gen=true
type AlertRulestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State AlertRuleStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewAlertRulestatusOperatorState creates a new AlertRulestatusOperatorState object.
func NewAlertRulestatusOperatorState() *AlertRulestatusOperatorState {
	return &AlertRulestatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertRulestatusOperatorState.
func (AlertRulestatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRulestatusOperatorState"
}

// Count of alert instances per state. error also counts instances whose evaluation
// errored but were mapped to another state via execErrState, so it can overlap.
// +k8s:openapi-gen=true
type AlertRuleAlertRuleInstanceTotals struct {
	Healthy    int64 `json:"healthy"`
	Firing     int64 `json:"firing"`
	Pending    int64 `json:"pending"`
	Recovering int64 `json:"recovering"`
	Nodata     int64 `json:"nodata"`
	Error      int64 `json:"error"`
}

// NewAlertRuleAlertRuleInstanceTotals creates a new AlertRuleAlertRuleInstanceTotals object.
func NewAlertRuleAlertRuleInstanceTotals() *AlertRuleAlertRuleInstanceTotals {
	return &AlertRuleAlertRuleInstanceTotals{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertRuleAlertRuleInstanceTotals.
func (AlertRuleAlertRuleInstanceTotals) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRuleAlertRuleInstanceTotals"
}

// +k8s:openapi-gen=true
type AlertRuleStatus struct {
	Health             *AlertRuleAlertRuleHealth      `json:"health,omitempty"`
	State              *AlertRuleAlertRuleState       `json:"state,omitempty"`
	StateReason        *AlertRuleAlertRuleStateReason `json:"stateReason,omitempty"`
	LastEvaluationTime *time.Time                     `json:"lastEvaluationTime,omitempty"`
	// duration of the last evaluation in seconds
	EvaluationDuration *float64 `json:"evaluationDuration,omitempty"`
	LastError          *string  `json:"lastError,omitempty"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]AlertRulestatusOperatorState `json:"operatorStates,omitempty"`
	Totals         *AlertRuleAlertRuleInstanceTotals       `json:"totals,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewAlertRuleStatus creates a new AlertRuleStatus object.
func NewAlertRuleStatus() *AlertRuleStatus {
	return &AlertRuleStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertRuleStatus.
func (AlertRuleStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRuleStatus"
}

// +k8s:openapi-gen=true
type AlertRuleStatusOperatorStateState string

const (
	AlertRuleStatusOperatorStateStateSuccess    AlertRuleStatusOperatorStateState = "success"
	AlertRuleStatusOperatorStateStateInProgress AlertRuleStatusOperatorStateState = "in_progress"
	AlertRuleStatusOperatorStateStateFailed     AlertRuleStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for AlertRuleStatusOperatorStateState.
func (AlertRuleStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.AlertRuleStatusOperatorStateState"
}

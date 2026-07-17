// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	time "time"
)

// +k8s:openapi-gen=true
type RecordingRuleRecordingRuleHealth string

const (
	RecordingRuleRecordingRuleHealthUnknown      RecordingRuleRecordingRuleHealth = "Unknown"
	RecordingRuleRecordingRuleHealthRecording    RecordingRuleRecordingRuleHealth = "Recording"
	RecordingRuleRecordingRuleHealthPaused       RecordingRuleRecordingRuleHealth = "Paused"
	RecordingRuleRecordingRuleHealthError        RecordingRuleRecordingRuleHealth = "Error"
	RecordingRuleRecordingRuleHealthNoData       RecordingRuleRecordingRuleHealth = "NoData"
	RecordingRuleRecordingRuleHealthNotScheduled RecordingRuleRecordingRuleHealth = "NotScheduled"
)

// OpenAPIModelName returns the OpenAPI model name for RecordingRuleRecordingRuleHealth.
func (RecordingRuleRecordingRuleHealth) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RecordingRuleRecordingRuleHealth"
}

// +k8s:openapi-gen=true
type RecordingRulestatusOperatorState struct {
	// lastEvaluation is the ResourceVersion last evaluated
	LastEvaluation string `json:"lastEvaluation"`
	// state describes the state of the lastEvaluation.
	// It is limited to three possible states for machine evaluation.
	State RecordingRuleStatusOperatorStateState `json:"state"`
	// descriptiveState is an optional more descriptive state field which has no requirements on format
	DescriptiveState *string `json:"descriptiveState,omitempty"`
	// details contains any extra information that is operator-specific
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewRecordingRulestatusOperatorState creates a new RecordingRulestatusOperatorState object.
func NewRecordingRulestatusOperatorState() *RecordingRulestatusOperatorState {
	return &RecordingRulestatusOperatorState{}
}

// OpenAPIModelName returns the OpenAPI model name for RecordingRulestatusOperatorState.
func (RecordingRulestatusOperatorState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RecordingRulestatusOperatorState"
}

// +k8s:openapi-gen=true
type RecordingRuleStatus struct {
	Health             *RecordingRuleRecordingRuleHealth `json:"health,omitempty"`
	LastEvaluationTime *time.Time                        `json:"lastEvaluationTime,omitempty"`
	EvaluationTime     *float64                          `json:"evaluationTime,omitempty"`
	// operatorStates is a map of operator ID to operator state evaluations.
	// Any operator which consumes this kind SHOULD add its state evaluation information to this field.
	OperatorStates map[string]RecordingRulestatusOperatorState `json:"operatorStates,omitempty"`
	LastError      *string                                     `json:"lastError,omitempty"`
	// additionalFields is reserved for future use
	AdditionalFields map[string]interface{} `json:"additionalFields,omitempty"`
}

// NewRecordingRuleStatus creates a new RecordingRuleStatus object.
func NewRecordingRuleStatus() *RecordingRuleStatus {
	return &RecordingRuleStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for RecordingRuleStatus.
func (RecordingRuleStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RecordingRuleStatus"
}

// +k8s:openapi-gen=true
type RecordingRuleStatusOperatorStateState string

const (
	RecordingRuleStatusOperatorStateStateSuccess    RecordingRuleStatusOperatorStateState = "success"
	RecordingRuleStatusOperatorStateStateInProgress RecordingRuleStatusOperatorStateState = "in_progress"
	RecordingRuleStatusOperatorStateStateFailed     RecordingRuleStatusOperatorStateState = "failed"
)

// OpenAPIModelName returns the OpenAPI model name for RecordingRuleStatusOperatorStateState.
func (RecordingRuleStatusOperatorStateState) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RecordingRuleStatusOperatorStateState"
}

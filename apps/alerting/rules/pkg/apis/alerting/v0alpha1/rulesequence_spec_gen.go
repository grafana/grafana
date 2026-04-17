// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RuleSequenceIntervalTrigger struct {
	Interval RuleSequencePromDuration `json:"interval"`
}

// NewRuleSequenceIntervalTrigger creates a new RuleSequenceIntervalTrigger object.
func NewRuleSequenceIntervalTrigger() *RuleSequenceIntervalTrigger {
	return &RuleSequenceIntervalTrigger{}
}

// OpenAPIModelName returns the OpenAPI model name for RuleSequenceIntervalTrigger.
func (RuleSequenceIntervalTrigger) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RuleSequenceIntervalTrigger"
}

// +k8s:openapi-gen=true
type RuleSequencePromDuration string

// +k8s:openapi-gen=true
type RuleSequenceRuleRef struct {
	Uid RuleSequenceRuleUID `json:"uid"`
}

// NewRuleSequenceRuleRef creates a new RuleSequenceRuleRef object.
func NewRuleSequenceRuleRef() *RuleSequenceRuleRef {
	return &RuleSequenceRuleRef{}
}

// OpenAPIModelName returns the OpenAPI model name for RuleSequenceRuleRef.
func (RuleSequenceRuleRef) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RuleSequenceRuleRef"
}

// +k8s:openapi-gen=true
type RuleSequenceRuleUID string

// +k8s:openapi-gen=true
type RuleSequenceSpec struct {
	Trigger RuleSequenceIntervalTrigger `json:"trigger"`
	// Non-empty constraint is enforced in Go admission validation (validator.go),
	// not in CUE. Using [...#RuleRef] instead of [#RuleRef, ...#RuleRef] avoids
	// a codegen bug where the CUE default generates invalid Go/TS defaults
	// (empty-UID RuleRef in Go, `uid: <nil>` in TypeScript).
	RecordingRules []RuleSequenceRuleRef `json:"recordingRules"`
	AlertingRules  []RuleSequenceRuleRef `json:"alertingRules,omitempty"`
}

// NewRuleSequenceSpec creates a new RuleSequenceSpec object.
func NewRuleSequenceSpec() *RuleSequenceSpec {
	return &RuleSequenceSpec{
		Trigger:        *NewRuleSequenceIntervalTrigger(),
		RecordingRules: []RuleSequenceRuleRef{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for RuleSequenceSpec.
func (RuleSequenceSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RuleSequenceSpec"
}

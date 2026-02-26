// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RuleChainIntervalTrigger struct {
	Interval RuleChainPromDuration `json:"interval"`
}

// NewRuleChainIntervalTrigger creates a new RuleChainIntervalTrigger object.
func NewRuleChainIntervalTrigger() *RuleChainIntervalTrigger {
	return &RuleChainIntervalTrigger{}
}

// OpenAPIModelName returns the OpenAPI model name for RuleChainIntervalTrigger.
func (RuleChainIntervalTrigger) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RuleChainIntervalTrigger"
}

// +k8s:openapi-gen=true
type RuleChainPromDuration string

// +k8s:openapi-gen=true
type RuleChainRuleRef struct {
	Uid RuleChainRuleUID `json:"uid"`
}

// NewRuleChainRuleRef creates a new RuleChainRuleRef object.
func NewRuleChainRuleRef() *RuleChainRuleRef {
	return &RuleChainRuleRef{}
}

// OpenAPIModelName returns the OpenAPI model name for RuleChainRuleRef.
func (RuleChainRuleRef) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RuleChainRuleRef"
}

// +k8s:openapi-gen=true
type RuleChainRuleUID string

// +k8s:openapi-gen=true
type RuleChainSpec struct {
	Trigger RuleChainIntervalTrigger `json:"trigger"`
	// Non-empty constraint is enforced in Go admission validation (validator.go),
	// not in CUE. Using [...#RuleRef] instead of [#RuleRef, ...#RuleRef] avoids
	// a codegen bug where the CUE default generates invalid Go/TS defaults
	// (empty-UID RuleRef in Go, `uid: <nil>` in TypeScript).
	RecordingRules []RuleChainRuleRef `json:"recordingRules"`
	AlertingRules  []RuleChainRuleRef `json:"alertingRules,omitempty"`
}

// NewRuleChainSpec creates a new RuleChainSpec object.
func NewRuleChainSpec() *RuleChainSpec {
	return &RuleChainSpec{
		Trigger:        *NewRuleChainIntervalTrigger(),
		RecordingRules: []RuleChainRuleRef{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for RuleChainSpec.
func (RuleChainSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rules.pkg.apis.alerting.v0alpha1.RuleChainSpec"
}

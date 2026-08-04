// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AlertRuleQualityPolicySpec struct {
	// requiredAnnotations lists the annotation keys every alert rule must set to
	// a non-empty value.
	//
	// Keys only, no per-key severity: required or not is the only axis a policy
	// expresses. Severity exists on findings and drives how the quality tab
	// ranks them, but it is a constant of the check, not a setting — so the tab
	// always ranks a missing runbook above a missing summary and that is not
	// configurable.
	//
	// Findings are reported in this order, so it is also the admin's chosen
	// order of importance.
	RequiredAnnotations []string `json:"requiredAnnotations"`
	// enforce turns the policy from advisory into a write-time gate: while it is
	// true, writes of rules that violate the policy are rejected.
	Enforce bool `json:"enforce"`
}

// NewAlertRuleQualityPolicySpec creates a new AlertRuleQualityPolicySpec object.
func NewAlertRuleQualityPolicySpec() *AlertRuleQualityPolicySpec {
	return &AlertRuleQualityPolicySpec{
		RequiredAnnotations: []string{},
		Enforce:             false,
	}
}

// OpenAPIModelName returns the OpenAPI model name for AlertRuleQualityPolicySpec.
func (AlertRuleQualityPolicySpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.quality.pkg.apis.alertingquality.v0alpha1.AlertRuleQualityPolicySpec"
}

// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type RulePolicyEnforcement string

const (
	RulePolicyEnforcementDeny RulePolicyEnforcement = "Deny"
	RulePolicyEnforcementWarn RulePolicyEnforcement = "Warn"
)

// OpenAPIModelName returns the OpenAPI model name for RulePolicyEnforcement.
func (RulePolicyEnforcement) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rulepolicy.pkg.apis.rulepolicy.v0alpha1.RulePolicyEnforcement"
}

// +k8s:openapi-gen=true
type RulePolicySpec struct {
	// What happens when an alert rule write breaks the policy. Deny rejects the write. Warn admits
	// it with a warning, so a policy can be assessed before it is enforced.
	Enforcement RulePolicyEnforcement `json:"enforcement"`
	// Labels that must be present and non-empty on every alert rule.
	RequiredLabels []string `json:"requiredLabels,omitempty"`
	// Annotations that must be present and non-empty on every alert rule.
	RequiredAnnotations []string `json:"requiredAnnotations,omitempty"`
	// Labels that must not be present on any alert rule, even with an empty value.
	ForbiddenLabels []string `json:"forbiddenLabels,omitempty"`
	// Annotations that must not be present on any alert rule, even with an empty value.
	ForbiddenAnnotations []string `json:"forbiddenAnnotations,omitempty"`
}

// NewRulePolicySpec creates a new RulePolicySpec object.
func NewRulePolicySpec() *RulePolicySpec {
	return &RulePolicySpec{}
}

// OpenAPIModelName returns the OpenAPI model name for RulePolicySpec.
func (RulePolicySpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.rulepolicy.pkg.apis.rulepolicy.v0alpha1.RulePolicySpec"
}

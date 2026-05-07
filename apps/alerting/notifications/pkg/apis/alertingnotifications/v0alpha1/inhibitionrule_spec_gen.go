// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type InhibitionRuleMatcher struct {
	Type  InhibitionRuleMatcherType `json:"type"`
	Label string                    `json:"label"`
	Value string                    `json:"value"`
}

// NewInhibitionRuleMatcher creates a new InhibitionRuleMatcher object.
func NewInhibitionRuleMatcher() *InhibitionRuleMatcher {
	return &InhibitionRuleMatcher{}
}

// OpenAPIModelName returns the OpenAPI model name for InhibitionRuleMatcher.
func (InhibitionRuleMatcher) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.InhibitionRuleMatcher"
}

// +k8s:openapi-gen=true
type InhibitionRuleSpec struct {
	// source_matchers define the alerts that act as inhibitors (silencing other alerts)
	SourceMatchers []InhibitionRuleMatcher `json:"source_matchers,omitempty"`
	// target_matchers define the alerts that can be inhibited (silenced)
	TargetMatchers []InhibitionRuleMatcher `json:"target_matchers,omitempty"`
	// equal specifies which labels must have equal values between source and target alerts
	// for the inhibition to take effect
	Equal []string `json:"equal,omitempty"`
}

// NewInhibitionRuleSpec creates a new InhibitionRuleSpec object.
func NewInhibitionRuleSpec() *InhibitionRuleSpec {
	return &InhibitionRuleSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for InhibitionRuleSpec.
func (InhibitionRuleSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.InhibitionRuleSpec"
}

// +k8s:openapi-gen=true
type InhibitionRuleMatcherType string

const (
	InhibitionRuleMatcherTypeEqual         InhibitionRuleMatcherType = "="
	InhibitionRuleMatcherTypeNotEqual      InhibitionRuleMatcherType = "!="
	InhibitionRuleMatcherTypeEqualRegex    InhibitionRuleMatcherType = "=~"
	InhibitionRuleMatcherTypeNotEqualRegex InhibitionRuleMatcherType = "!~"
)

// OpenAPIModelName returns the OpenAPI model name for InhibitionRuleMatcherType.
func (InhibitionRuleMatcherType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.notifications.pkg.apis.alertingnotifications.v0alpha1.InhibitionRuleMatcherType"
}

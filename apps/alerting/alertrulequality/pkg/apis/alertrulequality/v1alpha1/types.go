package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// AlertRuleQualityPolicy declares what a compliant Grafana-managed alert rule looks
// like for an org. It is a singleton: the only accepted name is DefaultPolicyName.
//
// It is the single source of truth for every consumer, so the validator that rejects a
// non-compliant rule and the views that report on rule quality cannot disagree about
// what compliant means.
//
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AlertRuleQualityPolicy struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec AlertRuleQualityPolicySpec `json:"spec,omitempty"`
}

func (AlertRuleQualityPolicy) OpenAPIModelName() string {
	return OpenAPIPrefix + "AlertRuleQualityPolicy"
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AlertRuleQualityPolicyList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []AlertRuleQualityPolicy `json:"items,omitempty"`
}

func (AlertRuleQualityPolicyList) OpenAPIModelName() string {
	return OpenAPIPrefix + "AlertRuleQualityPolicyList"
}

// AlertRuleQualityPolicySpec lists the fields an alert rule must carry.
//
// Both lists are optional and an empty policy requires nothing: a required field rejects
// rule creation and editing, so a policy nobody configured must not enforce anything.
type AlertRuleQualityPolicySpec struct {
	// Annotation keys that must be present and non-empty on every alert rule,
	// e.g. "summary", "description", "runbook_url".
	// +listType=set
	RequiredAnnotations []string `json:"requiredAnnotations,omitempty" yaml:"requiredAnnotations,omitempty" jsonschema:"description=Annotation keys every alert rule must set"`

	// Label keys that must be present and non-empty on every alert rule,
	// e.g. "team", "severity".
	// +listType=set
	RequiredLabels []string `json:"requiredLabels,omitempty" yaml:"requiredLabels,omitempty" jsonschema:"description=Label keys every alert rule must set"`
}

func (AlertRuleQualityPolicySpec) OpenAPIModelName() string {
	return OpenAPIPrefix + "AlertRuleQualityPolicySpec"
}

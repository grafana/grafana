package v0alpha1

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

// AlertRuleQualityPolicySpec defines compliance independently of write enforcement.
type AlertRuleQualityPolicySpec struct {
	// Annotation keys that must be present and non-empty for a rule to be compliant,
	// e.g. "summary", "description", "runbook_url".
	// +listType=map
	// +listMapKey=key
	RequiredAnnotations []FieldRequirement `json:"requiredAnnotations,omitempty" yaml:"requiredAnnotations,omitempty" jsonschema:"description=Annotation requirements for alert rule compliance"`

	// Label keys that must be present and non-empty for a rule to be compliant,
	// e.g. "team", "severity".
	// +listType=map
	// +listMapKey=key
	RequiredLabels []FieldRequirement `json:"requiredLabels,omitempty" yaml:"requiredLabels,omitempty" jsonschema:"description=Label requirements for alert rule compliance"`
}

func (AlertRuleQualityPolicySpec) OpenAPIModelName() string {
	return OpenAPIPrefix + "AlertRuleQualityPolicySpec"
}

type FieldRequirement struct {
	Key string `json:"key" yaml:"key"`

	// Enforcement is opt-in so a newly configured requirement can be assessed without
	// blocking alert rule writes.
	Enforce bool `json:"enforce,omitempty" yaml:"enforce,omitempty"`
}

func (FieldRequirement) OpenAPIModelName() string {
	return OpenAPIPrefix + "FieldRequirement"
}

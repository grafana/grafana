package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AlertStatus struct {
	metav1.TypeMeta `json:",inline"`

	// TODO... real fields here
	Dummy string `json:"dummy"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AlertRule struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// TODO, structure so the name is not in spec
	Spec Spec `json:"spec,omitempty"`
}

type Spec struct {
	// Describe the feature toggle
	Description string `json:"description"`

	// dummy.... but generats something!
	Targets []string `json:"targets"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AlertRuleList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []AlertRule `json:"items,omitempty"`
}

package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SSOSetting struct {
	metav1.TypeMeta `json:",inline"`
	// Standard object's metadata
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
	// +optional
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec SSOSettingSpec `json:"spec,omitempty"`
}

// SSOSettingSpec defines model for SSOSettingSpec.
type SSOSettingSpec struct {
	Source   Source              `json:"source"`
	Settings common.Unstructured `json:"settings"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SSOSettingList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []SSOSetting `json:"items"`
}

// Source for settings.
// +enum
type Source string

// Defines values for ItemType.
const (
	SourceDB Source = "db"
	// system is from config file, env or argument
	SourceSystem Source = "system"
)

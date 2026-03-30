package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const OpenAPIPrefix = "com.github.grafana.grafana.pkg.apis.appplugin.v0alpha1."

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Settings struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec SettingsSpec `json:"spec,omitempty"`
}

func (Settings) OpenAPIModelName() string {
	return OpenAPIPrefix + "Settings"
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SettingsList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Settings `json:"items"`
}

func (SettingsList) OpenAPIModelName() string {
	return OpenAPIPrefix + "SettingsList"
}

type SettingsSpec struct {
	Enabled          bool                `json:"enabled"`
	Pinned           bool                `json:"pinned"`
	JsonData         common.Unstructured `json:"jsonData"`
	SecureJsonFields map[string]bool     `json:"secureJsonFields"`
}

func (SettingsSpec) OpenAPIModelName() string {
	return OpenAPIPrefix + "SettingsSpec"
}

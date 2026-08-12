package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const OpenAPIPrefix = "com.github.grafana.grafana.pkg.apis.service.v0alpha1."

// +genclient
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ExternalName struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec ExternalNameSpec `json:"spec,omitempty"`
}

func (ExternalName) OpenAPIModelName() string {
	return OpenAPIPrefix + "ExternalName"
}

type ExternalNameSpec struct {
	Host string `json:"host,omitempty"`
}

func (ExternalNameSpec) OpenAPIModelName() string {
	return OpenAPIPrefix + "ExternalNameSpec"
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ExternalNameList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []ExternalName `json:"items"`
}

func (ExternalNameList) OpenAPIModelName() string {
	return OpenAPIPrefix + "ExternalNameList"
}

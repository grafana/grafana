package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryTemplate struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec QueryTemplateSpec `json:"spec,omitempty"`
}

type QueryTemplateSpec struct {
	Title     string                `json:"title,omitempty"`
	Variables []QueryVariable       `json:"vars,omitempty"`
	Targets   []common.Unstructured `json:"targets,omitempty"`
}

type QueryVariable struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type QueryTemplateList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []QueryTemplate `json:"items,omitempty"`
}

// Dummy object that represents a real query object
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type RenderedQuery struct {
	metav1.TypeMeta `json:",inline"`

	Targets []common.Unstructured `json:"targets,omitempty"`
}

package apis

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type AnyResource struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// Generic object
	Spec map[string]any `json:"spec,omitempty"`
}

type AnyResourceList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []map[string]any `json:"items"`
}

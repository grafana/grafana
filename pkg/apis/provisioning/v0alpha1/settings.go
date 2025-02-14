package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Summary shows a view of the configuration that is sanitized and is OK for logged in users to see
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type RepositoryViewList struct {
	metav1.TypeMeta `json:",inline"`

	// +mapType=atomic
	Items []RepositoryView `json:"items"`
}

type RepositoryView struct {
	// The k8s name for this repository
	Name string `json:"name"`

	// Repository display
	Title string `json:"title"`

	// Edit options within the repository
	ReadOnly bool `json:"readOnly"`

	// The repository type
	Type RepositoryType `json:"type"`

	// When syncing, where values are saved
	Target SyncTargetType `json:"target"`
}

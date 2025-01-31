package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Summary shows a view of the configuration that is sanitized and is OK for logged in users to see
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Summary struct {
	metav1.TypeMeta `json:",inline"`

	// When a repository is configured to save everything in instance
	Instance string `json:"instance,omitempty"`

	// Sanitized repository settings
	Repository map[string]RepositoryView `json:"repository"`
}

type RepositoryView struct {
	// Repository display
	Title string `json:"title"`

	// Describe the feature toggle
	Description string `json:"description,omitempty"`

	// Edit options within the repository
	Editing EditingOptions `json:"editing"`

	// The repository type
	Type RepositoryType `json:"type"`

	// When syncing, where values are saved
	Target SyncTargetType `json:"target"`

	// Is the repo healthy
	Healthy bool `json:"healthy"`
}

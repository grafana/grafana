package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardSnapshot struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Info SnapshotInfo `json:"info"`

	// The raw dashboard (??? openapi ???)
	Dashboard any `json:"dashboard"`

	// ??? not sure this should be exposed
	DeleteKey string `json:"deleteKey,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardSnapshotList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []SnapshotSummary `json:"items,omitempty"`
}

type SnapshotSummary struct {
	metav1.TypeMeta `json:",inline"`
	// Standard object's metadata
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
	// +optional
	metav1.ObjectMeta `json:"metadata,omitempty"`

	SnapshotInfo `json:",inline"`
}

type SnapshotInfo struct {
	Title       string `json:"title,omitempty"`
	Expires     int64  `json:"expires,omitempty"`
	ExternalURL string `json:"externalUrl,omitempty"`
	OriginalUrl string `json:"originalUrl,omitempty"`
	Timestamp   string `json:"timestamp,omitempty"`
}

// 	"externalUrl": "",
// 	"expires": "2073-10-21T12:46:06-07:00",

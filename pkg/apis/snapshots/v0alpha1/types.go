package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardSnapshot struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// Snapshot summary info
	Info SnapshotInfo `json:"info"`

	// The raw dashboard (??? openapi ???)
	// TODO: openapi annotations for codegen?
	Dashboard *simplejson.Json `json:"dashboard"`

	// The delete key is only returned when the item is created.  It is not returned from a get request
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

// Each tenant, may have different sharing options
// This is currently set using custom.ini, but multi-tenant support will need
// to be managed differently
type SnapshotSharingOptions struct {
	SnapshotsEnabled     bool   `json:"snapshotEnabled"`
	ExternalSnapshotURL  string `json:"externalSnapshotURL,omitempty"`
	ExternalSnapshotName string `json:"externalSnapshotName,omitempty"`
	ExternalEnabled      bool   `json:"externalEnabled,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SnapshotSharingConfig struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// Show the options inline
	SnapshotSharingOptions `json:",inline"`
}

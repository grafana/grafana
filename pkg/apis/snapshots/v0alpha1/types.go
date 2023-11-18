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
	// This will not be included in list commands
	Dashboard *simplejson.Json `json:"dashboard,omitempty"`

	// The delete key is only returned when the item is created.  It is not returned from a get request
	DeleteKey string `json:"deleteKey,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardSnapshotList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []DashboardSnapshot `json:"items,omitempty"`
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

// Represents an options object that must be named for each namespace/team/user
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SharingOptions struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// Show the options inline
	Spec SnapshotSharingOptions `json:"spec"`
}

// Represents a list of namespaced options
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SharingOptionsList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []SharingOptions `json:"items,omitempty"`
}

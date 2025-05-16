package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardSnapshot struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// Snapshot summary info
	Spec SnapshotInfo `json:"spec"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardSnapshotList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []DashboardSnapshot `json:"items"`
}

type SnapshotInfo struct {
	Title string `json:"title,omitempty"`
	// Optionally auto-remove the snapshot at a future date
	Expires int64 `json:"expires,omitempty"`
	// When set to true, the snapshot exists in a remote server
	External bool `json:"external,omitempty"`
	// The external URL where the snapshot can be seen
	ExternalURL string `json:"externalUrl,omitempty"`
	// The URL that created the dashboard originally
	OriginalUrl string `json:"originalUrl,omitempty"`
	// Snapshot creation timestamp
	Timestamp string `json:"timestamp,omitempty"`
}

// This is returned from the POST command
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardSnapshotWithDeleteKey struct {
	DashboardSnapshot `json:",inline"`

	// The delete key is only returned when the item is created.  It is not returned from a get request
	DeleteKey string `json:"deleteKey,omitempty"`
}

// This is the snapshot returned from the subresource
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FullDashboardSnapshot struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// Snapshot summary info
	Info SnapshotInfo `json:"info"`

	// The raw dashboard (unstructured for now)
	Dashboard common.Unstructured `json:"dashboard"`
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

// These are the values expected to be sent from an end user
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardCreateCommand struct {
	metav1.TypeMeta `json:",inline"`

	// Snapshot name
	// required:false
	Name string `json:"name"`

	// The complete dashboard model.
	// required:true
	Dashboard *common.Unstructured `json:"dashboard" binding:"Required"`

	// When the snapshot should expire in seconds in seconds. Default is never to expire.
	// required:false
	// default:0
	Expires int64 `json:"expires"`

	// these are passed when storing an external snapshot ref
	// Save the snapshot on an external server rather than locally.
	// required:false
	// default: false
	External bool `json:"external"`
}

// The create response
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardCreateResponse struct {
	metav1.TypeMeta `json:",inline"`

	// The unique key
	Key string `json:"key"`

	// A unique key that will allow delete
	DeleteKey string `json:"deleteKey"`

	// Absolute URL to show the dashboard
	URL string `json:"url"`

	// URL that will delete the response
	DeleteURL string `json:"deleteUrl"`
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
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []SharingOptions `json:"items"`
}

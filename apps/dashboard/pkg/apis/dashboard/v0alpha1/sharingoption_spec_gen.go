// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type SharingOptionSpec struct {
	// Snapshot title
	SnapshotsEnabled *bool `json:"snapshotsEnabled,omitempty"`
	// The external URL where the snapshot can be pushed
	ExternalSnapshotURL *string `json:"externalSnapshotURL,omitempty"`
	// The external name of the snapshot in the remote server
	ExternalSnapshotName *string `json:"externalSnapshotName,omitempty"`
	// External snapshots feature enabled
	ExternalEnabled *bool `json:"externalEnabled,omitempty"`
}

// NewSharingOptionSpec creates a new SharingOptionSpec object.
func NewSharingOptionSpec() *SharingOptionSpec {
	return &SharingOptionSpec{
		SnapshotsEnabled: (func(input bool) *bool { return &input })(false),
		ExternalEnabled:  (func(input bool) *bool { return &input })(false),
	}
}

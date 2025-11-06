// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type SnapshotSpec struct {
	// Snapshot title
	Title *string `json:"title,omitempty"`
	// Optionally auto-remove the snapshot at a future date (Unix timestamp in seconds)
	Expires *int64 `json:"expires,omitempty"`
	// When set to true, the snapshot exists in a remote server
	External *bool `json:"external,omitempty"`
	// The external URL where the snapshot can be seen
	ExternalUrl *string `json:"externalUrl,omitempty"`
	// The URL that created the dashboard originally
	OriginalUrl *string `json:"originalUrl,omitempty"`
	// Snapshot creation timestamp
	Timestamp *string `json:"timestamp,omitempty"`
	// The raw dashboard (unstructured for now)
	Dashboard map[string]interface{} `json:"Dashboard,omitempty"`
}

// NewSnapshotSpec creates a new SnapshotSpec object.
func NewSnapshotSpec() *SnapshotSpec {
	return &SnapshotSpec{
		Expires:  (func(input int64) *int64 { return &input })(0),
		External: (func(input bool) *bool { return &input })(false),
	}
}

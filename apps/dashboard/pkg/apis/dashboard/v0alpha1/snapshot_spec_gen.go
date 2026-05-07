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
	// Snapshot delete key
	DeleteKey *string `json:"deleteKey,omitempty"`
	// The raw dashboard (unstructured for now)
	Dashboard map[string]interface{} `json:"dashboard,omitempty"`
	// The dashboard payload encrypted at rest. Persisted in unified storage
	// in place of `dashboard`. The envelope is produced by the app-platform
	// EncryptionManager, which is namespace-scoped: dataKeyId identifies the
	// per-namespace data encryption key used to produce encryptedData.
	// Clients should not set this directly; it is populated by the storage
	// layer.
	DashboardEncrypted *SnapshotV0alpha1SpecDashboardEncrypted `json:"dashboardEncrypted,omitempty"`
}

// NewSnapshotSpec creates a new SnapshotSpec object.
func NewSnapshotSpec() *SnapshotSpec {
	return &SnapshotSpec{
		Expires:  (func(input int64) *int64 { return &input })(0),
		External: (func(input bool) *bool { return &input })(false),
	}
}

// OpenAPIModelName returns the OpenAPI model name for SnapshotSpec.
func (SnapshotSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v0alpha1.SnapshotSpec"
}

// +k8s:openapi-gen=true
type SnapshotV0alpha1SpecDashboardEncrypted struct {
	DataKeyId     string `json:"dataKeyId"`
	EncryptedData []byte `json:"encryptedData"`
}

// NewSnapshotV0alpha1SpecDashboardEncrypted creates a new SnapshotV0alpha1SpecDashboardEncrypted object.
func NewSnapshotV0alpha1SpecDashboardEncrypted() *SnapshotV0alpha1SpecDashboardEncrypted {
	return &SnapshotV0alpha1SpecDashboardEncrypted{}
}

// OpenAPIModelName returns the OpenAPI model name for SnapshotV0alpha1SpecDashboardEncrypted.
func (SnapshotV0alpha1SpecDashboardEncrypted) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.dashboard.pkg.apis.dashboard.v0alpha1.SnapshotV0alpha1SpecDashboardEncrypted"
}

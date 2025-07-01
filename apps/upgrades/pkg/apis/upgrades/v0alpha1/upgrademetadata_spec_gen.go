// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type UpgradeMetadataSpec struct {
	StartingVersion   string                   `json:"starting_version"`
	TargetVersion     string                   `json:"target_version"`
	State             UpgradeMetadataSpecState `json:"state"`
	IsOutOfSupport    bool                     `json:"is_out_of_support"`
	TargetReleaseDate string                   `json:"target_release_date"`
}

// NewUpgradeMetadataSpec creates a new UpgradeMetadataSpec object.
func NewUpgradeMetadataSpec() *UpgradeMetadataSpec {
	return &UpgradeMetadataSpec{}
}

// +k8s:openapi-gen=true
type UpgradeMetadataSpecState string

const (
	UpgradeMetadataSpecStateNew       UpgradeMetadataSpecState = "new"
	UpgradeMetadataSpecStateDismissed UpgradeMetadataSpecState = "dismissed"
	UpgradeMetadataSpecStateFailed    UpgradeMetadataSpecState = "failed"
	UpgradeMetadataSpecStateSucceeded UpgradeMetadataSpecState = "succeeded"
)

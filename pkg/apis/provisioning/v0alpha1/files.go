package v0alpha1

// +enum
type FileAction string

const (
	FileActionCreated FileAction = "created"
	FileActionUpdated FileAction = "updated"
	FileActionDeleted FileAction = "deleted"

	// Renamed actions may be reconstructed as delete then create
	FileActionRenamed FileAction = "renamed"
)

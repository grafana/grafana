package resource

import "uuid"

// NewBlobUID returns the UID for a newly uploaded blob. It is a UUIDv7 so that
// the upload time can be recovered by blob GC on stores with no age metadata.
func NewBlobUID() string {
	return uuid.NewV7().String()
}

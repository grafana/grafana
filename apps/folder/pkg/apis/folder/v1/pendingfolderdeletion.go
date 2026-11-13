package v1

import (
	"crypto/sha256"
	"fmt"
)

// PendingFolderDeletionName keeps arbitrary folder UIDs within Kubernetes name constraints.
func PendingFolderDeletionName(uid string) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(uid)))
}

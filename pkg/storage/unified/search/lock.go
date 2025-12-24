package search

import (
	"os"
	"time"

	bolt "go.etcd.io/bbolt"
)

// isLocked checks if the bolt database file at path is locked by another process.
// It uses bbolt's built-in file locking with a short timeout, following the scorch pattern.
// Returns true if the file exists and is locked by another process.
// Returns false if the file does not exist or is not locked.
func isLocked(path string) bool {
	// Use a short timeout to check if the file is locked.
	// If bolt.Open returns an error after the timeout, the file is locked.
	db, err := bolt.Open(path, 0600, &bolt.Options{
		Timeout:  100 * time.Millisecond,
		ReadOnly: true,
	})
	if err != nil {
		// Error opening means either file doesn't exist, or is locked.
		// Check if file exists to distinguish between the two cases.
		_, statErr := os.Stat(path)
		return statErr == nil
	}
	// Successfully opened, so not locked. Close it.
	_ = db.Close()
	return false
}

package schemaversion

import "fmt"

var _ error = &MigrationError{}

// ErrMigrationFailed is an error that is returned when a migration fails.
func NewMigrationError(msg string, currentVersion, targetVersion int) *MigrationError {
	return &MigrationError{
		msg:            msg,
		targetVersion:  targetVersion,
		currentVersion: currentVersion,
	}
}

// MigrationError is an error type for migration errors.
type MigrationError struct {
	msg            string
	targetVersion  int
	currentVersion int
}

func (e *MigrationError) Error() string {
	return fmt.Errorf("schema migration from version %d to %d failed: %v", e.currentVersion, e.targetVersion, e.msg).Error()
}

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

// MinimumVersionError is an error that is returned when the schema version is below the minimum version.
func NewMinimumVersionError(inputVersion int) *MinimumVersionError {
	return &MinimumVersionError{inputVersion: inputVersion}
}

// MinimumVersionError is an error type for minimum version errors.
type MinimumVersionError struct {
	inputVersion int
}

func (e *MinimumVersionError) Error() string {
	return fmt.Errorf("dashboard schema version %d cannot be migrated to latest version %d - migration path only exists for versions greater than %d", e.inputVersion, LATEST_VERSION, MIN_VERSION).Error()
}

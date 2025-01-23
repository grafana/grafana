package schemaversion

import "fmt"

var _ error = &MinimumVersionError{}
var _ error = &MigrationError{}

// MinimumVersionError is an error that is returned when the schema version is below the minimum version.
func NewMinimumVersionError(inputVersion int) *MinimumVersionError {
	return &MinimumVersionError{inputVersion: inputVersion}
}

// MinimumVersionError is an error type for minimum version errors.
type MinimumVersionError struct {
	inputVersion int
}

func (e *MinimumVersionError) Error() string {
	return fmt.Errorf("input schema version is below minimum version. input: %d minimum: %d", e.inputVersion, MINIUM_VERSION).Error()
}

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

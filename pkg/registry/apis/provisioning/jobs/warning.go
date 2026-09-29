package jobs

import "errors"

// warningError marks a benign condition that should complete a job in a warning
// state rather than a failure. Workers return it from Process when the job could
// not do its work for an expected, non-failing reason (for example, a feature
// disabled by configuration) so the outcome is not logged or alerted as an error.
type warningError struct {
	err error
}

func (w *warningError) Error() string { return w.err.Error() }
func (w *warningError) Unwrap() error { return w.err }

// AsWarning wraps err so that returning it from a Worker completes the job in a
// warning state instead of an error state. It returns nil when err is nil.
func AsWarning(err error) error {
	if err == nil {
		return nil
	}
	return &warningError{err: err}
}

// IsWarning reports whether err was marked as a warning-level condition via AsWarning.
func IsWarning(err error) bool {
	var w *warningError
	return errors.As(err, &w)
}

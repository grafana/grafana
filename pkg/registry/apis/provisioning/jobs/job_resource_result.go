package jobs

import (
	"errors"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

// WarningError is an interface for errors that should be classified as warnings
// in job progress tracking rather than errors. Any error type can implement this
// interface to be automatically classified as a warning.
type WarningError interface {
	error
	IsWarning() bool
}

// JobResourceResult represents the result of a resource operation in a job.
type JobResourceResult struct {
	name    string
	group   string
	kind    string
	path    string
	action  repository.FileAction
	err     error
	warning error
}

// NewJobResourceResultWithoutKind creates a new JobResourceResult without a name, group, and kind.
// This  is used for operations that cannot be references to a Grafana resource or when the resource is not yet known.
func NewJobResourceResultWithoutKind(path string, action repository.FileAction, err error) JobResourceResult {
	return NewJobResourceResult("", "", "", path, action, err)
}

// Builder for a skipped resource operation. It takes care of assign the right action and job error type.
func NewSkippedJobResourceResult(name, group, kind, path string, err error) JobResourceResult {
	return JobResourceResult{
		name:    name,
		group:   group,
		kind:    kind,
		path:    path,
		action:  repository.FileActionIgnored,
		warning: err,
		err:     nil,
	}
}

func isWarningError(err error) bool {
	var warningErr WarningError
	return errors.As(err, &warningErr) && warningErr.IsWarning()
}

// newJobResourceResult creates a new JobResourceResult.
// err is the error associated with the resource operation (can be nil).
func NewJobResourceResult(name, group, kind, path string, action repository.FileAction, err error) JobResourceResult {
	result := JobResourceResult{
		name:   name,
		group:  group,
		kind:   kind,
		path:   path,
		action: action,
	}
	if isWarningError(err) {
		result.warning = err
	} else {
		result.err = err
	}

	return result
}

// Name returns the name of the resource.
func (r JobResourceResult) Name() string {
	return r.name
}

// Group returns the group of the resource.
func (r JobResourceResult) Group() string {
	return r.group
}

// Kind returns the kind of the resource.
func (r JobResourceResult) Kind() string {
	return r.kind
}

// Path returns the path of the resource.
func (r JobResourceResult) Path() string {
	return r.path
}

// Action returns the action performed on the resource.
func (r JobResourceResult) Action() repository.FileAction {
	return r.action
}

// Error returns the error associated with the resource operation.
func (r JobResourceResult) Error() error {
	return r.err
}

// Warning returns the warning associated with the resource operation.
func (r JobResourceResult) Warning() error {
	return r.warning
}

package jobs

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// maybeNotifyProgress will only notify if a certain amount of time has passed
// or if the job completed
func maybeNotifyProgress(threshold time.Duration, fn ProgressFn) ProgressFn {
	var last time.Time
	var mu sync.Mutex

	return func(ctx context.Context, status provisioning.JobStatus) error {
		mu.Lock()
		shouldNotify := status.Finished != 0 || last.IsZero() || time.Since(last) > threshold
		if shouldNotify {
			last = time.Now()
		}
		mu.Unlock()

		if shouldNotify {
			return fn(ctx, status)
		}

		return nil
	}
}

// FIXME: ProgressRecorder should be initialized in the queue
type jobProgressRecorder struct {
	mu                  sync.RWMutex
	started             time.Time
	total               int
	maxErrors           int
	message             string
	finalMessage        string
	resultCount         int
	errorCount          int
	errors              []string
	refURLs             *provisioning.RepositoryURLs
	notifyImmediatelyFn ProgressFn
	maybeNotifyFn       ProgressFn
	summaries           map[string]*provisioning.JobResourceSummary
	failedCreations     []string // Tracks folder paths that failed to be created
	failedDeletions     []string // Tracks resource paths that failed to be deleted
}

func newJobProgressRecorder(ProgressFn ProgressFn) JobProgressRecorder {
	return &jobProgressRecorder{
		started: time.Now(),
		// Have a faster notifier for messages and total
		notifyImmediatelyFn: maybeNotifyProgress(500*time.Millisecond, ProgressFn),
		maybeNotifyFn:       maybeNotifyProgress(5*time.Second, ProgressFn),
		summaries:           make(map[string]*provisioning.JobResourceSummary),
	}
}

func (r *jobProgressRecorder) Started() time.Time {
	return r.started
}

func (r *jobProgressRecorder) Record(ctx context.Context, result JobResourceResult) {
	var (
		shouldLogError   bool
		shouldLogWarning bool
		logErr           error
		logWarning       error
	)

	r.mu.Lock()
	r.resultCount++

	if result.Error() != nil {
		shouldLogError = true
		logErr = result.Error()

		// Don't count ignored actions as errors in error count or error list
		if result.Action() != repository.FileActionIgnored {
			if len(r.errors) < 20 {
				r.errors = append(r.errors, result.Error().Error())
			}
			r.errorCount++
		}

		// Automatically track failed operations based on error type and action
		// Check if this is a PathCreationError (folder creation failure)
		var pathErr *resources.PathCreationError
		if errors.As(result.Error(), &pathErr) {
			r.failedCreations = append(r.failedCreations, pathErr.Path)
		}

		// Track failed deletions, any deletion will stop the deletion of the parent folder (as it won't be empty)

		if result.Action() == repository.FileActionDeleted {
			r.failedDeletions = append(r.failedDeletions, result.Path())
		}
	} else if result.Warning() != nil {
		// Still track failed deletions in case we get a warning
		if result.Action() == repository.FileActionDeleted {
			r.failedDeletions = append(r.failedDeletions, result.Path())
		}

		shouldLogWarning = true
		logWarning = result.Warning()
	}

	r.updateSummary(result)
	r.mu.Unlock()

	logger := logging.FromContext(ctx).With("path", result.Path(), "group", result.Group(), "kind", result.Kind(), "action", result.Action(), "name", result.Name())
	if shouldLogError {
		logger.Error("job resource operation failed", "err", logErr)
	} else if shouldLogWarning {
		logger.Warn("job resource operation completed with warning", "err", logWarning)
	} else {
		logger.Info("job resource operation succeeded")
	}

	r.maybeNotify(ctx)
}

// ResetResults will reset the results of the job.
// If the keepWarnings flag is set to true, the summary will preserve the warnings in it.
func (r *jobProgressRecorder) ResetResults(keepWarnings bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.resultCount = 0
	r.errorCount = 0
	r.errors = nil
	r.failedCreations = nil
	r.failedDeletions = nil

	summaries := make(map[string]*provisioning.JobResourceSummary)
	for k, summary := range r.summaries {
		if len(summary.Warnings) > 0 && keepWarnings {
			summaries[k] = summary
		}
	}
	r.summaries = summaries
}

func (r *jobProgressRecorder) SetMessage(ctx context.Context, msg string) {
	r.mu.Lock()
	r.message = msg
	r.mu.Unlock()

	logging.FromContext(ctx).Info("job progress message", "message", msg)
	r.notifyImmediately(ctx)
}

func (r *jobProgressRecorder) SetFinalMessage(ctx context.Context, msg string) {
	r.mu.Lock()
	r.finalMessage = msg
	r.mu.Unlock()

	logging.FromContext(ctx).Info("job final message", "message", msg)
}

func (r *jobProgressRecorder) SetRefURLs(ctx context.Context, refURLs *provisioning.RepositoryURLs) {
	r.mu.Lock()
	r.refURLs = refURLs
	r.mu.Unlock()

	if refURLs != nil {
		logging.FromContext(ctx).Debug("job ref URLs set", "sourceURL", refURLs.SourceURL, "compareURL", refURLs.CompareURL, "newPullRequestURL", refURLs.NewPullRequestURL)
	} else {
		logging.FromContext(ctx).Debug("job ref URLs cleared")
	}
}

func (r *jobProgressRecorder) SetTotal(ctx context.Context, total int) {
	r.mu.Lock()
	r.total = total
	r.mu.Unlock()

	r.notifyImmediately(ctx)
}

func (r *jobProgressRecorder) StrictMaxErrors(maxErrors int) {
	r.mu.Lock()
	r.maxErrors = maxErrors
	r.mu.Unlock()
}

func (r *jobProgressRecorder) TooManyErrors() error {
	if r.maxErrors > 0 && r.errorCount >= r.maxErrors {
		return fmt.Errorf("too many errors: %d", r.errorCount)
	}

	return nil
}

func (r *jobProgressRecorder) summary() []*provisioning.JobResourceSummary {
	if len(r.summaries) == 0 {
		return nil
	}

	summaries := make([]*provisioning.JobResourceSummary, 0, len(r.summaries))
	for _, summary := range r.summaries {
		summaries = append(summaries, summary)
	}

	return summaries
}

func (r *jobProgressRecorder) updateSummary(result JobResourceResult) {
	// Note: This method is called from Record() which already holds the lock
	key := result.Group() + ":" + result.Kind()
	summary, exists := r.summaries[key]
	if !exists {
		summary = &provisioning.JobResourceSummary{
			Group: result.Group(),
			Kind:  result.Kind(),
		}
		r.summaries[key] = summary
	}

	if result.Error() != nil {
		errorMsg := fmt.Sprintf("%s (file: %s, name: %s, action: %s)", result.Error().Error(), result.Path(), result.Name(), result.Action())
		summary.Errors = append(summary.Errors, errorMsg)
		summary.Error++
	} else if result.Warning() != nil {
		warningMsg := fmt.Sprintf("%s (file: %s, name: %s, action: %s)", result.Warning().Error(), result.Path(), result.Name(), result.Action())
		summary.Warnings = append(summary.Warnings, warningMsg)
		summary.Warning++
	} else {
		switch result.Action() {
		case repository.FileActionDeleted:
			summary.Delete++
		case repository.FileActionUpdated:
			summary.Update++
		case repository.FileActionCreated:
			summary.Create++
		case repository.FileActionIgnored:
			summary.Noop++
		case repository.FileActionRenamed:
			summary.Delete++
			summary.Create++
		}
		summary.Write = summary.Create + summary.Update
	}
}

func (r *jobProgressRecorder) progress() float64 {
	// Note: This method is called from currentStatus() which already holds the lock
	if r.total == 0 {
		return 0
	}

	return float64(r.resultCount) / float64(r.total) * 100
}

func (r *jobProgressRecorder) currentStatus() provisioning.JobStatus {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return provisioning.JobStatus{
		Started:  r.started.UnixMilli(),
		State:    provisioning.JobStateWorking,
		Message:  r.message,
		Errors:   r.errors,
		Progress: r.progress(),
		Summary:  r.summary(),
	}
}

func (r *jobProgressRecorder) notifyImmediately(ctx context.Context) {
	jobStatus := r.currentStatus()
	logger := logging.FromContext(ctx)
	if err := r.notifyImmediatelyFn(ctx, jobStatus); err != nil {
		logger.Warn("error notifying immediate progress", "err", err)
	}
}

func (r *jobProgressRecorder) maybeNotify(ctx context.Context) {
	jobStatus := r.currentStatus()

	logger := logging.FromContext(ctx)
	if err := r.maybeNotifyFn(ctx, jobStatus); err != nil {
		logger.Warn("error notifying progress", "err", err)
	}
}

func (r *jobProgressRecorder) Complete(ctx context.Context, err error) provisioning.JobStatus {
	r.mu.RLock()

	jobStatus := provisioning.JobStatus{
		Started:  r.started.UnixMilli(),
		Finished: time.Now().UnixMilli(),
		State:    provisioning.JobStateSuccess,
		Message:  "completed successfully",
	}

	if err != nil {
		jobStatus.State = provisioning.JobStateError
		jobStatus.Message = err.Error()
	}

	summaries := r.summary()
	jobStatus.Summary = summaries
	jobStatus.Errors = r.errors

	// Extract warnings from summaries
	warnings := make([]string, 0) //nolint:prealloc
	for _, summary := range summaries {
		warnings = append(warnings, summary.Warnings...)
	}
	jobStatus.Warnings = warnings

	jobStatus.URLs = r.refURLs

	tooManyErrors := r.maxErrors > 0 && r.errorCount >= r.maxErrors
	finalMessage := r.finalMessage

	r.mu.RUnlock()

	if len(jobStatus.Errors) > 0 && jobStatus.State != provisioning.JobStateError {
		if tooManyErrors {
			jobStatus.Message = "completed with too many errors"
		} else {
			jobStatus.Message = "completed with errors"
		}
		jobStatus.State = provisioning.JobStateError
	} else if len(jobStatus.Warnings) > 0 {
		jobStatus.State = provisioning.JobStateWarning
		jobStatus.Message = "completed with warnings"
	}

	// Override message if progress have a more explicit message
	if finalMessage != "" && jobStatus.State != provisioning.JobStateError {
		jobStatus.Message = finalMessage
	}

	return jobStatus
}

// HasDirPathFailedCreation checks if a path is nested under any failed folder creation
func (r *jobProgressRecorder) HasDirPathFailedCreation(path string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, failedCreation := range r.failedCreations {
		if safepath.InDir(path, failedCreation) {
			return true
		}
	}
	return false
}

// HasDirPathFailedDeletion checks if any resource deletions failed under a folder path
func (r *jobProgressRecorder) HasDirPathFailedDeletion(folderPath string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, failedDeletion := range r.failedDeletions {
		if safepath.InDir(failedDeletion, folderPath) {
			return true
		}
	}
	return false
}

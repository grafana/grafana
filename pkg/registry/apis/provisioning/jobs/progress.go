package jobs

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
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
type JobResourceResult struct {
	Name     string
	Resource string
	Group    string
	Path     string
	Action   repository.FileAction
	Error    error
}

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

func (r *jobProgressRecorder) Record(ctx context.Context, result JobResourceResult) {
	r.mu.Lock()
	r.resultCount++

	logger := logging.FromContext(ctx).With("path", result.Path, "resource", result.Resource, "group", result.Group, "action", result.Action, "name", result.Name)
	if result.Error != nil {
		logger.Error("job resource operation failed", "err", result.Error)
		if len(r.errors) < 20 {
			r.errors = append(r.errors, result.Error.Error())
		}
		r.errorCount++
	} else {
		logger.Info("job resource operation succeeded")
	}

	r.updateSummary(result)
	r.mu.Unlock()

	r.maybeNotify(ctx)
}

// ResetResults will reset the results of the job
func (r *jobProgressRecorder) ResetResults() {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.resultCount = 0
	r.errorCount = 0
	r.errors = nil
	r.summaries = make(map[string]*provisioning.JobResourceSummary)
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
	r.mu.RLock()
	defer r.mu.RUnlock()

	if r.maxErrors > 0 && r.errorCount >= r.maxErrors {
		return fmt.Errorf("too many errors: %d", r.errorCount)
	}

	return nil
}

func (r *jobProgressRecorder) summary() []*provisioning.JobResourceSummary {
	r.mu.RLock()
	defer r.mu.RUnlock()

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
	key := result.Resource + ":" + result.Group
	summary, exists := r.summaries[key]
	if !exists {
		summary = &provisioning.JobResourceSummary{
			Resource: result.Resource,
			Group:    result.Group,
		}
		r.summaries[key] = summary
	}

	if result.Error != nil {
		errorMsg := fmt.Sprintf("%s (file: %s, name: %s, action: %s)", result.Error.Error(), result.Path, result.Name, result.Action)
		summary.Errors = append(summary.Errors, errorMsg)
		summary.Error++
	} else {
		switch result.Action {
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
	defer r.mu.RUnlock()

	// Initialize base job status
	jobStatus := provisioning.JobStatus{
		Started: r.started.UnixMilli(),
		// FIXME: if we call this method twice, the state will be different
		// This results in sync status to be different from job status
		Finished: time.Now().UnixMilli(),
		State:    provisioning.JobStateSuccess,
		Message:  "completed successfully",
	}

	if err != nil {
		jobStatus.State = provisioning.JobStateError
		jobStatus.Message = err.Error()
	}

	jobStatus.Summary = r.summary()
	jobStatus.Errors = r.errors
	jobStatus.URLs = r.refURLs

	// Check for errors during execution
	if len(jobStatus.Errors) > 0 && jobStatus.State != provisioning.JobStateError {
		if r.TooManyErrors() != nil {
			jobStatus.Message = "completed with too many errors"
			jobStatus.State = provisioning.JobStateError
		} else {
			jobStatus.Message = "completed with errors"
			jobStatus.State = provisioning.JobStateWarning
		}
	}

	// Override message if progress have a more explicit message
	if r.finalMessage != "" && jobStatus.State != provisioning.JobStateError {
		jobStatus.Message = r.finalMessage
	}

	return jobStatus
}

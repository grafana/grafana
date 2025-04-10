package jobs

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

// maybeNotifyProgress will only notify if a certain amount of time has passed
// or if the job completed
func maybeNotifyProgress(threshold time.Duration, fn ProgressFn) ProgressFn {
	var last time.Time

	return func(ctx context.Context, status provisioning.JobStatus) error {
		if status.Finished != 0 || last.IsZero() || time.Since(last) > threshold {
			last = time.Now()
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
	started             time.Time
	total               int
	message             string
	finalMessage        string
	resultCount         int
	errorCount          int
	errors              []string
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
	r.maybeNotify(ctx)
}

// ResetResults will reset the results of the job
func (r *jobProgressRecorder) ResetResults() {
	r.resultCount = 0
	r.errorCount = 0
	r.errors = nil
	r.summaries = make(map[string]*provisioning.JobResourceSummary)
}

func (r *jobProgressRecorder) SetMessage(ctx context.Context, msg string) {
	r.message = msg
	logging.FromContext(ctx).Info("job progress message", "message", msg)
	r.notifyImmediately(ctx)
}

func (r *jobProgressRecorder) SetFinalMessage(ctx context.Context, msg string) {
	r.finalMessage = msg
	logging.FromContext(ctx).Info("job final message", "message", msg)
}

func (r *jobProgressRecorder) SetTotal(ctx context.Context, total int) {
	r.total = total

	r.notifyImmediately(ctx)
}

func (r *jobProgressRecorder) TooManyErrors() error {
	if r.errorCount > 20 {
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
		summary.Errors = append(summary.Errors, result.Error.Error())
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
	if r.total == 0 {
		return 0
	}

	return float64(r.resultCount) / float64(r.total) * 100
}

func (r *jobProgressRecorder) notifyImmediately(ctx context.Context) {
	jobStatus := provisioning.JobStatus{
		State:    provisioning.JobStateWorking,
		Message:  r.message,
		Errors:   r.errors,
		Progress: r.progress(),
		Summary:  r.summary(),
	}

	logger := logging.FromContext(ctx)
	if err := r.notifyImmediatelyFn(ctx, jobStatus); err != nil {
		logger.Warn("error notifying immediate progress", "err", err)
	}
}

func (r *jobProgressRecorder) maybeNotify(ctx context.Context) {
	jobStatus := provisioning.JobStatus{
		State:    provisioning.JobStateWorking,
		Message:  r.message,
		Errors:   r.errors,
		Progress: r.progress(),
		Summary:  r.summary(),
	}

	logger := logging.FromContext(ctx)
	if err := r.maybeNotifyFn(ctx, jobStatus); err != nil {
		logger.Warn("error notifying progress", "err", err)
	}
}

func (r *jobProgressRecorder) Complete(ctx context.Context, err error) provisioning.JobStatus {
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

	// Check for errors during execution
	if len(jobStatus.Errors) > 0 && jobStatus.State != provisioning.JobStateError {
		jobStatus.State = provisioning.JobStateError
		jobStatus.Message = "completed with errors"
	}

	// Override message if progress have a more explicit message
	if r.finalMessage != "" && jobStatus.State != provisioning.JobStateError {
		jobStatus.Message = r.finalMessage
	}

	return jobStatus
}

package sync

import (
	"context"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type JobResourceResult struct {
	Name     string
	Resource string
	Group    string
	Path     string
	Action   repository.FileAction
	Error    error
}

type JobProgressRecorder struct {
	total      int
	ref        string
	message    string
	results    []JobResourceResult
	progressFn jobs.ProgressFn
}

func (r *JobProgressRecorder) Record(ctx context.Context, result JobResourceResult) {
	if r.results == nil {
		r.results = make([]JobResourceResult, 0)
	}
	r.results = append(r.results, result)

	logger := logging.FromContext(ctx)

	if result.Error != nil {
		logger.Error("job resource operation failed", "err", result.Error, "path", result.Path, "resource", result.Resource, "group", result.Group, "action", result.Action, "name", result.Name)
	}

	r.UpdateProgress(ctx)
}

func (r *JobProgressRecorder) SetMessage(msg string) {
	r.message = msg
}

func (r *JobProgressRecorder) GetMessage() string {
	return r.message
}

func (r *JobProgressRecorder) SetRef(ref string) {
	r.ref = ref
}

func (r *JobProgressRecorder) GetRef() string {
	return r.ref
}

func (r *JobProgressRecorder) Summary() []*provisioning.JobResourceSummary {
	if len(r.results) == 0 {
		return nil
	}

	// Group results by resource+group
	groupedResults := make(map[string][]JobResourceResult)
	for _, result := range r.results {
		key := result.Resource + ":" + result.Group
		groupedResults[key] = append(groupedResults[key], result)
	}

	summaries := make([]*provisioning.JobResourceSummary, 0)
	for _, results := range groupedResults {
		if len(results) == 0 {
			continue
		}

		// Count actions
		actions := make(map[repository.FileAction]int64)
		var errors []string
		for _, result := range results {
			if result.Error != nil {
				errors = append(errors, result.Error.Error())
			} else {
				actions[result.Action]++
			}
		}

		// Create summary for this group

		// Default to unknown if resource or group is empty
		resource := results[0].Resource
		if resource == "" {
			resource = "unknown"
		}

		group := results[0].Group
		if group == "" {
			group = "unknown"
		}

		summary := &provisioning.JobResourceSummary{
			Resource: resource,
			Group:    group,
			Delete:   actions[repository.FileActionDeleted],
			Update:   actions[repository.FileActionUpdated],
			Create:   actions[repository.FileActionCreated],
			Write:    actions[repository.FileActionCreated] + actions[repository.FileActionUpdated],
			Error:    int64(len(errors)),
			Noop:     actions[repository.FileActionIgnored],
			Errors:   errors,
		}

		summaries = append(summaries, summary)
	}

	return summaries
}

func (r *JobProgressRecorder) Progress() float64 {
	return float64(r.total - len(r.results)/r.total*100)
}

func (r *JobProgressRecorder) Errors() []string {
	if len(r.results) == 0 {
		return nil
	}

	errors := make([]string, 0)
	for _, result := range r.results {
		if result.Error != nil {
			errors = append(errors, result.Error.Error())
		}
	}

	return errors
}

func (r *JobProgressRecorder) UpdateProgress(ctx context.Context) {
	jobStatus := provisioning.JobStatus{
		State:    provisioning.JobStateWorking,
		Message:  r.message,
		Errors:   r.Errors(),
		Progress: r.Progress(),
		Summary:  r.Summary(),
	}

	logger := logging.FromContext(ctx)
	if err := r.progressFn(ctx, jobStatus); err != nil {
		logger.Warn("error notifying progress", "err", err)
	}
}

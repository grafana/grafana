package sync

import (
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type Result struct {
	Name     string
	Resource string
	Group    string
	Path     string
	Action   repository.FileAction
	Error    error
}

type ResultsRecorder struct {
	Total   int
	Ref     string
	Message string
	results []Result
}

func (r *ResultsRecorder) Record(result Result) {
	if r.results == nil {
		r.results = make([]Result, 0)
	}
	r.results = append(r.results, result)
}

func (r *ResultsRecorder) Summary() []*provisioning.JobResourceSummary {
	if len(r.results) == 0 {
		return nil
	}

	// Group results by resource+group
	groupedResults := make(map[string][]Result)
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

func (r *ResultsRecorder) Progress() float64 {
	return float64(r.Total - len(r.results)/r.Total*100)
}

func (r *ResultsRecorder) Errors() []string {
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

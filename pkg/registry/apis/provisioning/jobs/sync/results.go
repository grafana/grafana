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

type ResultsRecorder struct{}

func (r *ResultsRecorder) Record(result Result) {
}

func (r *ResultsRecorder) Summary() []*provisioning.JobResourceSummary {
	return nil
}

func (r *ResultsRecorder) Errors() []string {
	return nil
}

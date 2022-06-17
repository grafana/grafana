package provider

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins/executor"
	"github.com/grafana/grafana/pkg/plugins/executor/jobs/noop"
)

type Service interface {
	ProvideJobs(ctx context.Context) []executor.Job
}

type OSSJobs struct{}

func New() *OSSJobs {
	return &OSSJobs{}
}

func (s *OSSJobs) ProvideJobs(_ context.Context) []executor.Job {
	return []executor.Job{noop.New()}
}

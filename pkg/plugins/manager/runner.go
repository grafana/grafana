package manager

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

type Runner struct{}

func ProvideRunnerService() *Runner {
	return &Runner{}
}

func (r *Runner) Run(_ context.Context, _ plugins.Manager) error {
	return nil
}

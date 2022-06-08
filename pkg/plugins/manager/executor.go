package manager

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

var _ plugins.ManagerExecutor = (*NoopExecutor)(nil)

type NoopExecutor struct{}

func ProvideNoopExecutor() *NoopExecutor {
	return &NoopExecutor{}
}

func (r *NoopExecutor) Execute(_ context.Context, _ plugins.Manager) error {
	return nil
}

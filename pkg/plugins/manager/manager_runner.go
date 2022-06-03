package manager

import (
	"context"
)

var _ Runner = (*NoopRunner)(nil)

type NoopRunner struct{}

func ProvideNoopRunner() *NoopRunner {
	return &NoopRunner{}
}

func (r *NoopRunner) Run(_ context.Context, _ Service) error {
	return nil
}

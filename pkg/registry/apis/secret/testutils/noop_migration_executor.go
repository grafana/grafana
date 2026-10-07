package testutils

import "context"

type NoopMigrationExecutor struct {
}

func (e *NoopMigrationExecutor) Execute(ctx context.Context) (int, error) {
	return 0, nil
}

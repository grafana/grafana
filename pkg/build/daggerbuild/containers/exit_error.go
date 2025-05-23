package containers

import (
	"context"
	"errors"
	"fmt"

	"dagger.io/dagger"
)

var (
	ErrorNonZero = errors.New("container exited with non-zero exit code")
)

// ExitError functionally replaces '(*container).ExitCode' in a more usable way.
// It will return an error with the container's stderr and stdout if the exit code is not zero.
func ExitError(ctx context.Context, container *dagger.Container) (*dagger.Container, error) {
	container, err := container.Sync(ctx)
	if err == nil {
		return container, nil
	}

	var e *dagger.ExecError
	if errors.As(err, &e) {
		return container, fmt.Errorf("%w\nstdout: %s\nstderr: %s", ErrorNonZero, e.Stdout, e.Stderr)
	}

	return container, err
}

package executil

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
)

func RunAt(ctx context.Context, dir, cmd string, args ...string) error {
	// Ignore gosec G204 as this function is only used in the build process.
	//nolint:gosec
	c := exec.CommandContext(ctx, cmd, args...)
	c.Dir = dir

	b, err := c.CombinedOutput()

	if err != nil {
		return fmt.Errorf("%w. '%s %v': %s", err, cmd, args, string(b))
	}

	return nil
}

func Run(ctx context.Context, cmd string, args ...string) error {
	return RunAt(ctx, ".", cmd, args...)
}

func OutputAt(ctx context.Context, dir, cmd string, args ...string) (string, error) {
	// Ignore gosec G204 as this function is only used in the build process.
	//nolint:gosec
	c := exec.CommandContext(ctx, cmd, args...)
	c.Dir = dir

	b, err := c.CombinedOutput()

	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(b)), nil
}

func Output(ctx context.Context, cmd string, args ...string) (string, error) {
	return OutputAt(ctx, ".", cmd, args...)
}

package lerna

import (
	"context"
	"fmt"
	"os"
	"os/exec"

	"github.com/grafana/grafana/pkg/build/fsutil"
)

func PackFrontendPackages(ctx context.Context, tag, grafanaDir, artifactsDir string) error {
	exists, err := fsutil.Exists(artifactsDir)
	if err != nil {
		return err
	}
	if exists {
		err = os.RemoveAll(artifactsDir)
		if err != nil {
			return err
		}
	}
	// nolint:gosec
	if err = os.MkdirAll(artifactsDir, 0755); err != nil {
		return err
	}

	// nolint:gosec
	cmd := exec.CommandContext(ctx, "yarn", "lerna", "exec", "--no-private", "--", "yarn", "pack", "--out", fmt.Sprintf("../../npm-artifacts/%%s-%v.tgz", tag))
	cmd.Dir = grafanaDir
	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("command '%s' failed to run, output: %s, err: %q", cmd.String(), output, err)
	}

	return nil
}

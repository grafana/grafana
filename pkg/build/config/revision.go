package config

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/build/executil"
)

type Revision struct {
	Timestamp int64
	SHA256    string
	Branch    string
}

func GrafanaTimestamp(ctx context.Context, dir string) (int64, error) {
	out, err := executil.OutputAt(ctx, dir, "git", "show", "-s", "--format=%ct")
	if err != nil {
		return time.Now().Unix(), nil
	}

	stamp, err := strconv.ParseInt(out, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse output from git show: %q", out)
	}

	return stamp, nil
}

// GrafanaRevision uses git commands to get information about the checked out Grafana code located at 'grafanaDir'.
// This could maybe be a more generic "Describe" function in the "git" package.
func GrafanaRevision(ctx context.Context, grafanaDir string) (Revision, error) {
	stamp, err := GrafanaTimestamp(ctx, grafanaDir)
	if err != nil {
		return Revision{}, err
	}

	sha, err := executil.OutputAt(ctx, grafanaDir, "git", "rev-parse", "--short", "HEAD")
	if err != nil {
		return Revision{}, err
	}

	branch, err := executil.OutputAt(ctx, grafanaDir, "git", "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return Revision{}, err
	}

	return Revision{
		SHA256:    sha,
		Branch:    branch,
		Timestamp: stamp,
	}, nil
}

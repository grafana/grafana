package artifacts

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
	"github.com/urfave/cli/v2"
)

// TryStoreFromHostDist loads a pre-built artifact from the local filesystem (under --destination)
// when a matching file or directory exists, skipping an in-container rebuild.
func TryStoreFromHostDist(ctx context.Context, log *slog.Logger, a *pipeline.Artifact, opts *pipeline.ArtifactContainerOpts) (bool, error) {
	if opts.CLIContext == nil || opts.CLIContext.Bool("no-host-dist") {
		return false, nil
	}

	destRoot, err := resolveDestinationDir(opts.CLIContext)
	if err != nil {
		return false, err
	}

	name, err := a.Handler.Filename(ctx)
	if err != nil {
		return false, err
	}

	hostPath := filepath.Join(destRoot, filepath.FromSlash(name))
	st, err := os.Stat(hostPath)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, fmt.Errorf("stat host artifact %s: %w", hostPath, err)
	}

	switch a.Type {
	case pipeline.ArtifactTypeFile:
		if st.IsDir() {
			return false, nil
		}
		log.Info("using existing artifact file from host dist", "path", hostPath, "artifact", a.ArtifactString)
		f := opts.Client.Host().File(hostPath)
		return true, opts.Store.StoreFile(ctx, a, f)
	case pipeline.ArtifactTypeDirectory:
		if !st.IsDir() {
			return false, nil
		}
		log.Info("using existing artifact directory from host dist", "path", hostPath, "artifact", a.ArtifactString)
		d := opts.Client.Host().Directory(hostPath)
		return true, opts.Store.StoreDirectory(ctx, a, d)
	default:
		return false, nil
	}
}

func resolveDestinationDir(c *cli.Context) (string, error) {
	d := c.String("destination")
	if d == "" {
		d = "dist"
	}
	if filepath.IsAbs(d) {
		return filepath.Clean(d), nil
	}
	wd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("get wd for destination %q: %w", d, err)
	}
	return filepath.Clean(filepath.Join(wd, d)), nil
}

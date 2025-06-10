package arguments

import (
	"context"
	"fmt"
	"log/slog"
	"path"
	"path/filepath"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/cliutil"
	"github.com/grafana/grafana/pkg/build/daggerbuild/containers"
	"github.com/grafana/grafana/pkg/build/daggerbuild/daggerutil"
	"github.com/grafana/grafana/pkg/build/daggerbuild/frontend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/git"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
	"github.com/urfave/cli/v2"
)

const BusyboxImage = "busybox:1.36"

func InitializeEnterprise(d *dagger.Client, grafana *dagger.Directory, enterprise *dagger.Directory) *dagger.Directory {
	hash := d.Container().From("alpine/git").
		WithDirectory("/src/grafana-enterprise", enterprise).
		WithWorkdir("/src/grafana-enterprise").
		WithEntrypoint([]string{}).
		WithExec([]string{"/bin/sh", "-c", "git rev-parse HEAD > .buildinfo.enterprise-commit"}).
		File("/src/grafana-enterprise/.buildinfo.enterprise-commit")

	return d.Container().From(BusyboxImage).
		WithDirectory("/src/grafana", grafana).
		WithDirectory("/src/grafana-enterprise", enterprise).
		WithWorkdir("/src/grafana-enterprise").
		WithFile("/src/grafana/.buildinfo.enterprise-commit", hash).
		WithExec([]string{"/bin/sh", "build.sh"}).
		WithExec([]string{"cp", "LICENSE", "../grafana"}).
		Directory("/src/grafana")
}

// GrafnaaOpts are populated by the 'GrafanaFlags' flags.
// These options define how to mount or clone the grafana/enterprise source code.
type GrafanaDirectoryOpts struct {
	// GrafanaDir is the path to the Grafana source tree.
	// If GrafanaDir is empty, then we're most likely cloning Grafana and using that as a directory.
	GrafanaDir    string
	EnterpriseDir string
	// GrafanaRepo will clone Grafana from a different repository when cloning Grafana.
	GrafanaRepo    string
	EnterpriseRepo string
	// GrafanaRef will checkout a specific tag, branch, or commit when cloning Grafana.
	GrafanaRef    string
	EnterpriseRef string
	// GitHubToken is used when cloning Grafana/Grafana Enterprise.
	GitHubToken string

	PatchesRepo string
	PatchesPath string
	PatchesRef  string
}

func githubToken(ctx context.Context, token string) (string, error) {
	// Since GrafanaDir was not provided, we must clone it.
	ght := token

	// If GitHubToken was not set from flag
	if ght != "" {
		return ght, nil
	}

	token, err := git.LookupGitHubToken(ctx)
	if err != nil {
		return "", err
	}
	if token == "" {
		return "", fmt.Errorf("unable to acquire github token")
	}

	return token, nil
}

func GrafanaDirectoryOptsFromFlags(c cliutil.CLIContext) *GrafanaDirectoryOpts {
	return &GrafanaDirectoryOpts{
		GrafanaRepo:    c.String("grafana-repo"),
		EnterpriseRepo: c.String("enterprise-repo"),
		GrafanaDir:     c.String("grafana-dir"),
		EnterpriseDir:  c.String("enterprise-dir"),
		GrafanaRef:     c.String("grafana-ref"),
		EnterpriseRef:  c.String("enterprise-ref"),
		GitHubToken:    c.String("github-token"),
		PatchesRepo:    c.String("patches-repo"),
		PatchesPath:    c.String("patches-path"),
		PatchesRef:     c.String("patches-ref"),
	}
}

func cloneOrMount(ctx context.Context, client *dagger.Client, localPath, repo, ref string, ght string) (*dagger.Directory, error) {
	if localPath != "" {
		absolute, err := filepath.Abs(localPath)
		if err != nil {
			return nil, fmt.Errorf("error getting absolute path for local dir: %w", err)
		}
		localPath = absolute
		slog.Info("Using local directory for repository", "path", localPath, "repo", repo)
		return daggerutil.HostDir(client, localPath)
	}

	ght, err := githubToken(ctx, ght)
	if err != nil {
		return nil, fmt.Errorf("error acquiring GitHub token: %w", err)
	}

	return git.CloneWithGitHubToken(client, ght, repo, ref)
}

func applyPatches(ctx context.Context, client *dagger.Client, src *dagger.Directory, repo, patchesPath, ref, ght string) (*dagger.Directory, error) {
	ght, err := githubToken(ctx, ght)
	if err != nil {
		return nil, fmt.Errorf("error acquiring GitHub token: %w", err)
	}

	// Clone the patches repository on 'main'
	dir, err := git.CloneWithGitHubToken(client, ght, repo, ref)
	if err != nil {
		return nil, fmt.Errorf("error cloning patches repository: %w", err)
	}

	entries, err := dir.Entries(ctx, dagger.DirectoryEntriesOpts{
		Path: patchesPath,
	})
	if err != nil {
		return nil, fmt.Errorf("error listing entries in repository: %w", err)
	}

	if len(entries) == 0 {
		return nil, fmt.Errorf("no patches in the given path")
	}

	container := client.Container().From(git.GitImage).
		WithEntrypoint([]string{}).
		WithMountedDirectory("/src", src).
		WithMountedDirectory("/patches", dir).
		WithWorkdir("/src").
		WithExec([]string{"git", "config", "--local", "user.name", "grafana"}).
		WithExec([]string{"git", "config", "--local", "user.email", "engineering@grafana.com"})

	for _, v := range entries {
		if filepath.Ext(v) != ".patch" {
			continue
		}

		container = container.WithExec([]string{"/bin/sh", "-c", fmt.Sprintf(`git am --3way --ignore-whitespace --ignore-space-change --committer-date-is-author-date %s > /dev/null 2>&1`, path.Join("/patches", patchesPath, v))})
	}

	return container.Directory("/src"), nil
}

func grafanaDirectory(ctx context.Context, opts *pipeline.ArgumentOpts) (any, error) {
	o := GrafanaDirectoryOptsFromFlags(opts.CLIContext)

	src, err := cloneOrMount(ctx, opts.Client, o.GrafanaDir, o.GrafanaRepo, o.GrafanaRef, o.GitHubToken)
	if err != nil {
		return nil, err
	}

	gitContainer := opts.Client.Container().From("alpine/git").
		WithWorkdir("/src").
		WithMountedDirectory("/src/.git", src.Directory(".git")).
		WithEntrypoint([]string{})

	commitFile := gitContainer.
		WithExec([]string{"/bin/sh", "-c", "git rev-parse HEAD > .buildinfo.grafana-commit"}).
		File("/src/.buildinfo.grafana-commit")

	branchFile := gitContainer.
		WithExec([]string{"/bin/sh", "-c", "git rev-parse --abbrev-ref HEAD > .buildinfo.grafana-branch"}).
		File("/src/.buildinfo.grafana-branch")

	src = src.
		WithFile(".buildinfo.commit", commitFile).
		WithFile(".buildinfo.branch", branchFile)

	if o.PatchesRepo != "" {
		withPatches, err := applyPatches(ctx, opts.Client, src, o.PatchesRepo, o.PatchesPath, o.PatchesRef, o.GitHubToken)
		if err != nil {
			opts.Log.Debug("patch application skipped", "error", err)
		} else {
			// Only replace src when there was no error.
			src = withPatches
		}
	}

	nodeVersion, err := frontend.NodeVersion(opts.Client, src).Stdout(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get node version from source code: %w", err)
	}

	yarnCache, err := opts.State.CacheVolume(ctx, YarnCacheDirectory)
	if err != nil {
		return nil, err
	}

	container := frontend.YarnInstall(opts.Client, src, nodeVersion, yarnCache, opts.Platform)

	if _, err := containers.ExitError(ctx, container); err != nil {
		return nil, err
	}

	return container.Directory("/src"), nil
}

func enterpriseDirectory(ctx context.Context, opts *pipeline.ArgumentOpts) (any, error) {
	// Get the Grafana directory...
	o := GrafanaDirectoryOptsFromFlags(opts.CLIContext)

	grafanaDir, err := grafanaDirectory(ctx, opts)
	if err != nil {
		return nil, fmt.Errorf("error initializing grafana directory: %w", err)
	}

	clone, err := cloneOrMount(ctx, opts.Client, o.EnterpriseDir, o.EnterpriseRepo, o.EnterpriseRef, o.GitHubToken)
	if err != nil {
		return nil, fmt.Errorf("error cloning or mounting Grafana Enterprise directory: %w", err)
	}

	return InitializeEnterprise(opts.Client, grafanaDir.(*dagger.Directory), clone), nil
}

var GrafanaDirectoryFlags = []cli.Flag{
	&cli.StringFlag{
		Name:     "grafana-dir",
		Usage:    "Local Grafana dir to use, instead of git clone",
		Required: false,
	},
	&cli.StringFlag{
		Name:     "enterprise-dir",
		Usage:    "Local Grafana Enterprise dir to use, instead of git clone",
		Required: false,
	},
	&cli.StringFlag{
		Name:     "grafana-repo",
		Usage:    "Grafana repo to clone, not valid if --grafana-dir is set",
		Required: false,
		Value:    "https://github.com/grafana/grafana.git",
	},
	&cli.StringFlag{
		Name:     "enterprise-repo",
		Usage:    "Grafana Enterprise repo to clone, not valid if --grafana-dir is set",
		Required: false,
		Value:    "https://github.com/grafana/grafana-enterprise.git",
	},
	&cli.StringFlag{
		Name:     "grafana-ref",
		Usage:    "Grafana ref to clone, not valid if --grafana-dir is set",
		Required: false,
		Value:    "main",
	},
	&cli.StringFlag{
		Name:     "enterprise-ref",
		Usage:    "Grafana Enterprise ref to clone, not valid if --grafana-dir is set",
		Required: false,
		Value:    "main",
	},
	&cli.StringFlag{
		Name:     "github-token",
		Usage:    "GitHub token to use for git cloning, by default will be pulled from GitHub",
		Required: false,
	},
	&cli.StringFlag{
		Name:  "patches-repo",
		Usage: "GitHub repository that contains git patches to apply to the Grafana source code. Must be an https git URL",
	},
	&cli.StringFlag{
		Name:  "patches-path",
		Usage: "Path to folder containing '.patch' files to apply",
	},
	&cli.StringFlag{
		Name:  "patches-ref",
		Usage: "Ref to checkout in the patches repository",
		Value: "main",
	},
}

// GrafanaDirectory will provide the valueFunc that initializes and returns a *dagger.Directory that has Grafana in it.
// Where possible, when cloning and no authentication options are provided, the valuefunc will try to use the configured github CLI for cloning.
var GrafanaDirectory = pipeline.Argument{
	Name:        "grafana-dir",
	Description: "The source tree of the Grafana repository",
	Flags:       GrafanaDirectoryFlags,
	ValueFunc:   grafanaDirectory,
}

// EnterpriseDirectory will provide the valueFunc that initializes and returns a *dagger.Directory that has Grafana Enterprise initialized it.
// Where possible, when cloning and no authentication options are provided, the valuefunc will try to use the configured github CLI for cloning.
var EnterpriseDirectory = pipeline.Argument{
	Name:        "enterprise-dir",
	Description: "The source tree of Grafana Enterprise",
	Flags:       GrafanaDirectoryFlags,
	ValueFunc:   enterpriseDirectory,
}

package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path"
	"strings"

	"github.com/google/go-github/github"
	"github.com/urfave/cli/v2"
	"golang.org/x/oauth2"
)

type repo struct {
	owner string
	name  string
}

type flags struct {
	create       bool
	dryRun       bool
	tag          string
	repo         *repo
	artifactPath string
}

var (
	errTokenIsEmpty    = errors.New("the environment variable GH_TOKEN must be set")
	errTagIsEmpty      = errors.New(`failed to retrieve release tag from metadata, use "--tag" to set it manually`)
	errReleaseNotFound = errors.New(`release not found, use "--create" to create the release`)
)

func PublishGitHub(ctx *cli.Context) error {
	gitCtx := context.Background()
	token := os.Getenv("GH_TOKEN")
	f, err := getFlags(ctx)
	if err != nil {
		return cli.NewExitError(err, 1)
	}

	if f.tag == "" {
		return cli.NewExitError(errTagIsEmpty, 1)
	}

	if token == "" {
		return cli.NewExitError(errTokenIsEmpty, 1)
	}

	if f.dryRun {
		return runDryRun(f, token, gitCtx)
	}

	client := newClient(gitCtx, token)
	release, res, err := client.Repositories.GetReleaseByTag(gitCtx, f.repo.owner, f.repo.name, f.tag)
	if err != nil && res.StatusCode != 404 {
		return cli.NewExitError(err, 1)
	}

	if release == nil {
		if f.create {
			release, _, err = client.Repositories.CreateRelease(gitCtx, f.repo.owner, f.repo.name, &github.RepositoryRelease{TagName: &f.tag})
			if err != nil {
				return cli.NewExitError(err, 1)
			}
		} else {
			return cli.NewExitError(errReleaseNotFound, 1)
		}
	}

	artifactName := path.Base(f.artifactPath)
	file, err := os.Open(f.artifactPath)
	if err != nil {
		return cli.NewExitError(err, 1)
	}

	asset, _, err := client.Repositories.UploadReleaseAsset(gitCtx, f.repo.owner, f.repo.name, *release.ID, &github.UploadOptions{Name: artifactName}, file)
	if err != nil {
		return cli.NewExitError(err, 1)
	}
	fmt.Printf("Asset '%s' uploaded to release '%s' on repository '%s/%s'\nDownload: %s\n", *asset.Name, f.tag, f.repo.owner, f.repo.name, *asset.BrowserDownloadURL)
	return nil
}

func newClient(ctx context.Context, token string) *github.Client {
	ts := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: token},
	)
	tc := oauth2.NewClient(ctx, ts)

	return github.NewClient(tc)
}

func getFlags(ctx *cli.Context) (*flags, error) {
	metadata, err := GenerateMetadata(ctx)
	if err != nil {
		return nil, err
	}
	tag := ctx.Value("tag").(string)
	if tag == "" {
		tag = fmt.Sprintf("v%s", metadata.GrafanaVersion)
	}
	fullRepo := ctx.Value("repo").(string)
	dryRun := ctx.Value("dry-run").(bool)
	owner := strings.Split(fullRepo, "/")[0]
	name := strings.Split(fullRepo, "/")[1]
	create := ctx.Value("create").(bool)
	artifactPath := ctx.Value("path").(string)
	return &flags{
		artifactPath: artifactPath,
		create:       create,
		dryRun:       dryRun,
		tag:          tag,
		repo: &repo{
			owner: owner,
			name:  name,
		},
	}, nil
}

func runDryRun(f *flags, token string, gitCtx context.Context) error {
	client := newClient(gitCtx, token)
	fmt.Println("Dry-Run: Retrieving release on repository by tag")
	release, res, err := client.Repositories.GetReleaseByTag(gitCtx, f.repo.owner, f.repo.name, f.tag)
	if err != nil && res.StatusCode != 404 {
		fmt.Println("Dry-Run: GitHub communication error:\n", err)
		return nil
	}

	if release == nil {
		if f.create {
			fmt.Println("Dry-Run: Release doesn't exist and --create is enabled, so it would try to create the release")
		} else {
			fmt.Println("Dry-Run: Release doesn't exist and --create is disabled, so it would fail with error")
			return nil
		}
	}

	artifactName := path.Base(f.artifactPath)
	fmt.Printf("Dry-Run: Opening file for release: %s\n", f.artifactPath)
	_, err = os.Open(f.artifactPath)
	if err != nil {
		fmt.Println("Dry-Run: Error opening file\n", err)
		return nil
	}

	fmt.Printf("Dry-Run: Would upload asset '%s' to release '%s' on repo '%s/%s' and return download URL if successful\n", artifactName, f.tag, f.repo.owner, f.repo.name)
	return nil
}

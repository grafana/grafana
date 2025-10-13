package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path"
	"strings"

	"github.com/google/go-github/v69/github"
	"github.com/urfave/cli/v2"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/build/config"
)

type githubRepositoryService interface {
	GetReleaseByTag(ctx context.Context, owner string, repo string, tag string) (*github.RepositoryRelease, *github.Response, error)
	CreateRelease(ctx context.Context, owner string, repo string, release *github.RepositoryRelease) (*github.RepositoryRelease, *github.Response, error)
	UploadReleaseAsset(ctx context.Context, owner string, repo string, id int64, opt *github.UploadOptions, file *os.File) (*github.ReleaseAsset, *github.Response, error)
	DeleteReleaseAsset(ctx context.Context, owner string, repo string, id int64) (*github.Response, error)
	ListReleaseAssets(ctx context.Context, owner string, repo string, id int64, opt *github.ListOptions) ([]*github.ReleaseAsset, *github.Response, error)
}

type githubRepo struct {
	owner string
	name  string
}

type publishGithubFlags struct {
	create       bool
	dryRun       bool
	tag          string
	repo         *githubRepo
	artifactPath string
}

var (
	newGithubClient    = githubRepositoryClient
	errTokenIsEmpty    = errors.New("the environment variable GH_TOKEN must be set")
	errTagIsEmpty      = errors.New(`failed to retrieve release tag from metadata, use "--tag" to set it manually`)
	errReleaseNotFound = errors.New(`release not found, use "--create" to create the release`)
)

func PublishGithub(c *cli.Context) error {
	ctx := c.Context
	token := os.Getenv("GH_TOKEN")
	f, err := getPublishGithubFlags(c)
	if err != nil {
		return err
	}

	if f.tag == "" {
		return errTagIsEmpty
	}

	if token == "" {
		return errTokenIsEmpty
	}

	if f.dryRun {
		return runPublishGithubDryRun(f, token, c)
	}

	client := newGithubClient(ctx, token)
	release, res, err := client.GetReleaseByTag(ctx, f.repo.owner, f.repo.name, f.tag)
	if err != nil && res.StatusCode != 404 {
		return err
	}

	if release == nil {
		if f.create {
			release, _, err = client.CreateRelease(ctx, f.repo.owner, f.repo.name, &github.RepositoryRelease{TagName: &f.tag})
			if err != nil {
				return err
			}
		} else {
			return errReleaseNotFound
		}
	}

	artifactName := path.Base(f.artifactPath)
	file, err := os.Open(f.artifactPath)
	if err != nil {
		return err
	}

	assetsPage := 1
	foundAsset := false
	for {
		assets, resp, err := client.ListReleaseAssets(ctx, f.repo.owner, f.repo.name, *release.ID, &github.ListOptions{
			Page: assetsPage,
		})
		if err != nil {
			return err
		}
		for _, asset := range assets {
			if asset.GetName() == artifactName {
				fmt.Printf("Found existing artifact with the name '%s'. Deleting that now.\n", artifactName)
				if _, err := client.DeleteReleaseAsset(ctx, f.repo.owner, f.repo.name, asset.GetID()); err != nil {
					return fmt.Errorf("failed to delete already existing asset: %w", err)
				}
				foundAsset = true
				break
			}
		}
		if resp.NextPage <= assetsPage || foundAsset {
			break
		}
		assetsPage = resp.NextPage
	}

	asset, _, err := client.UploadReleaseAsset(ctx, f.repo.owner, f.repo.name, *release.ID, &github.UploadOptions{Name: artifactName}, file)
	if err != nil {
		return err
	}
	fmt.Printf("Asset '%s' uploaded to release '%s' on repository '%s/%s'\nDownload: %s\n", *asset.Name, f.tag, f.repo.owner, f.repo.name, *asset.BrowserDownloadURL)
	return nil
}

func githubRepositoryClient(ctx context.Context, token string) githubRepositoryService {
	ts := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: token},
	)
	tc := oauth2.NewClient(ctx, ts)

	client := github.NewClient(tc)
	return client.Repositories
}

func getPublishGithubFlags(c *cli.Context) (*publishGithubFlags, error) {
	metadata, err := config.GenerateMetadata(c)
	if err != nil {
		return nil, err
	}
	tag := c.Value("tag").(string)
	if tag == "" && metadata.GrafanaVersion != "" {
		tag = fmt.Sprintf("v%s", metadata.GrafanaVersion)
	}
	fullRepo := c.Value("repo").(string)
	dryRun := c.Value("dry-run").(bool)
	owner := strings.Split(fullRepo, "/")[0]
	name := strings.Split(fullRepo, "/")[1]
	create := c.Value("create").(bool)
	artifactPath := c.Value("path").(string)
	if artifactPath == "" {
		artifactPath = fmt.Sprintf("grafana-enterprise2-%s-amd64.img", metadata.GrafanaVersion)
		fmt.Printf("path argument is not provided, resolving to default %s...\n", artifactPath)
	}
	return &publishGithubFlags{
		artifactPath: artifactPath,
		create:       create,
		dryRun:       dryRun,
		tag:          tag,
		repo: &githubRepo{
			owner: owner,
			name:  name,
		},
	}, nil
}

func runPublishGithubDryRun(f *publishGithubFlags, token string, c *cli.Context) error {
	client := newGithubClient(c.Context, token)
	fmt.Println("Dry-Run: Retrieving release on repository by tag")
	release, res, err := client.GetReleaseByTag(c.Context, f.repo.owner, f.repo.name, f.tag)
	if err != nil && res.StatusCode != 404 {
		fmt.Println("Dry-Run: Github communication error:\n", err)
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

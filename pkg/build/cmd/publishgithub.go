package main

import (
	"errors"
	"fmt"
	"os"

	"github.com/grafana/grafana/pkg/build/github"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/urfave/cli/v2"
)

var (
	errTokenIsEmpty    = errors.New("the environment variable GH_TOKEN must be set")
	errReleaseNotFound = errors.New(`release not found, use "--create" to create the release`)
)

func PublishGitHub(ctx *cli.Context) error {
	tag := ctx.Value("tag").(string)
	repo := ctx.Value("repo").(string)
	token := os.Getenv("GH_TOKEN")
	if token == "" {
		return errTokenIsEmpty
	}

	release, err := github.GetReleaseByTag(token, repo, tag)
	if err != nil {
		return err
	}

	// dryRun := ctx.Value("dry-run").(bool)
	create := ctx.Value("create").(bool)
	if release.Id < 1 {
		if create {
			release, err = github.CreateReleaseByTag(token, repo, tag)
			if err != nil {
				return err
			}
		} else {
			return errReleaseNotFound
		}
	}

	artifactPath := ctx.Value("path").(string)
	asset, err := github.UploadAsset(token, release, artifactPath)
	if err != nil {
		return err
	}

	logger.Info(fmt.Sprintf(`Asset "%s" uploaded to release "%s": %s`, asset.Name, tag, asset.DownloadUrl))
	return nil
}

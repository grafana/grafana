package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/gitutil"
	"github.com/urfave/cli/v2"
)

func BuildFrontend(c *cli.Context) error {
	version := ""
	if c.NArg() == 1 {
		version = strings.TrimPrefix(c.Args().Get(0), "v")
	}

	metadata, err := config.GetMetadata(filepath.Join("dist", "version.json"))
	if err != nil {
		return err
	}

	edition := config.Edition(c.String("edition"))
	cfg := config.Config{
		GitHubToken: c.String("github-token"),
	}
	ctx := context.Background()
	ghClient := gitutil.NewGitHubClient(ctx, cfg)

	const grafanaDir = "."
	if version == "" {
		buildID := c.String("build-id")
		var err error
		version, err = config.GetGrafanaVersion(buildID, grafanaDir)
		if err != nil {
			return err
		}
	}
	verMode := metadata.ReleaseMode

	if edition == config.EditionEnterprise || edition == config.EditionEnterprise2 {
		if err := gitutil.PullEnterpriseBits(ctx, ghClient, cfg, grafanaDir, version, verMode); err != nil {
			return cli.Exit(err.Error(), 1)
		}
	}

	log.Printf("Running front-end test suite")
	cmd := exec.Command("yarn", "run", "ci:test-frontend")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return cli.Exit(fmt.Sprintf("go test failed: %s", err), 1)
	}

	return nil
}

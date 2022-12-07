// Package verifystorybook contains the sub-command "verify-storybook".
package main

import (
	"fmt"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/rs/zerolog/log"
	"github.com/urfave/cli/v2"
)

// VerifyStorybook Action implements the sub-command "verify-storybook".
func VerifyStorybook(c *cli.Context) error {
	const grafanaDir = "."

	paths := []string{
		"packages/grafana-ui/dist/storybook/index.html",
		"packages/grafana-ui/dist/storybook/iframe.html"}
	for _, p := range paths {
		exists, err := fs.Exists(filepath.Join(grafanaDir, p))
		if err != nil {
			return cli.NewExitError(fmt.Sprintf("failed to verify Storybook build: %s", err), 1)
		}
		if !exists {
			return fmt.Errorf("failed to verify Storybook build, missing %q", p)
		}
	}

	log.Printf("Successfully verified Storybook integrity")
	return nil
}

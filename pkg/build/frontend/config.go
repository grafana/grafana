package frontend

import (
	"fmt"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/urfave/cli/v2"
)

const GrafanaDir = "."

func GetConfig(c *cli.Context, version string) (config.Config, config.Edition, error) {
	cfg := config.Config{
		NumWorkers:     c.Int("jobs"),
		GitHubToken:    c.String("github-token"),
		PackageVersion: version,
	}

	mode := config.Edition(c.String("edition"))
	buildID := c.String("build-id")
	packageVersion, err := config.GetGrafanaVersion(buildID, GrafanaDir)
	if err != nil {
		return config.Config{}, "", cli.Exit(err.Error(), 1)
	}

	if version == "" {
		cfg.PackageVersion = packageVersion
		if err != nil {
			return config.Config{}, config.EditionOSS, cli.Exit(err.Error(), 1)
		}
	} else {
		if version != packageVersion {
			return config.Config{}, "", cli.Exit(fmt.Errorf("package.json version and input tag version differ %s != %s", packageVersion, version), 1)
		}
	}

	return cfg, mode, nil
}

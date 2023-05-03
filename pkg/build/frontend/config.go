package frontend

import (
	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/config"
)

const GrafanaDir = "."

func GetConfig(c *cli.Context, version string) (config.Config, config.Edition, error) {
	cfg := config.Config{
		NumWorkers:     c.Int("jobs"),
		GitHubToken:    c.String("github-token"),
		PackageVersion: version,
	}

	mode := config.Edition(c.String("edition"))

	if version == "" {
		buildID := c.String("build-id")
		var err error
		version, err = config.GetGrafanaVersion(buildID, GrafanaDir)
		cfg.PackageVersion = version
		if err != nil {
			return config.Config{}, config.EditionOSS, cli.Exit(err.Error(), 1)
		}
	}

	return cfg, mode, nil
}

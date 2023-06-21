package frontend

import (
	"fmt"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/urfave/cli/v2"
)

const GrafanaDir = "."

func GetConfig(c *cli.Context, metadata config.Metadata) (config.Config, config.Edition, error) {
	cfg := config.Config{
		NumWorkers:  c.Int("jobs"),
		GitHubToken: c.String("github-token"),
	}

	mode := config.Edition(c.String("edition"))

	if metadata.ReleaseMode.Mode == config.TagMode && !metadata.ReleaseMode.IsTest {
		packageJSONVersion, err := config.GetPackageJSONVersion(GrafanaDir)
		if err != nil {
			return config.Config{}, "", err
		}
		if metadata.GrafanaVersion != packageJSONVersion {
			return config.Config{}, "", cli.Exit(fmt.Errorf("package.json version and input tag version differ %s != %s.\nPlease update package.json", packageJSONVersion, metadata.GrafanaVersion), 1)
		}
	}

	cfg.PackageVersion = metadata.GrafanaVersion
	return cfg, mode, nil
}

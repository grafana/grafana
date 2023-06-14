package frontend

import (
<<<<<<< HEAD
=======
	"fmt"

>>>>>>> a6b524fd56 (NPM packages: Fail `build-frontend-packages` step if `package.json` and input tag differ (#70011))
	"github.com/grafana/grafana/pkg/build/config"
	"github.com/urfave/cli/v2"
)

const GrafanaDir = "."

func GetConfig(c *cli.Context, inputTagVersion string) (config.Config, config.Edition, error) {
	cfg := config.Config{
		NumWorkers:     c.Int("jobs"),
		GitHubToken:    c.String("github-token"),
		PackageVersion: inputTagVersion,
	}

	mode := config.Edition(c.String("edition"))
	buildID := c.String("build-id")
	packageVersion, err := config.GetGrafanaVersion(buildID, GrafanaDir)
	if err != nil {
		return config.Config{}, "", cli.Exit(err.Error(), 1)
	}

	if inputTagVersion == "" {
		cfg.PackageVersion = packageVersion
		if err != nil {
			return config.Config{}, config.EditionOSS, cli.Exit(err.Error(), 1)
		}
		return cfg, mode, err
	}
	if inputTagVersion != packageVersion {
		return config.Config{}, "", cli.Exit(fmt.Errorf("package.json version and input tag version differ %s != %s.\nPlease update package.json", packageVersion, inputTagVersion), 1)
	}

	cfg.PackageVersion = inputTagVersion
	return cfg, mode, nil
}

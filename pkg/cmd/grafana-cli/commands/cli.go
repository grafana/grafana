package commands

import (
	"os"
	"runtime"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
)

// RunCLI is the entrypoint for the grafana-cli command. It returns the exit code for the grafana-cli program.
func CLICommand(version string) *cli.Command {
	return &cli.Command{
		Name:  "cli",
		Usage: "run the grafana cli",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "config",
				Usage: "Path to config file",
			},
			&cli.StringFlag{
				Name:  "homepath",
				Usage: "Path to Grafana install/home path, defaults to working directory",
			},
			&cli.StringFlag{
				Name:  "configOverrides",
				Usage: "Configuration options to override defaults as a string. e.g. cfg:default.paths.log=/dev/null",
			},
			cli.VersionFlag,
			&cli.BoolFlag{
				Name:  "debug, d",
				Usage: "Enable debug logging",
			},
			&cli.StringFlag{
				Name:    "pluginsDir",
				Usage:   "Path to the Grafana plugin directory",
				Value:   utils.GetGrafanaPluginDir(runtime.GOOS),
				EnvVars: []string{"GF_PLUGIN_DIR"},
			},
			&cli.StringFlag{
				Name:    "repo",
				Usage:   "URL to the plugin repository",
				Value:   "https://grafana.com/api/plugins",
				EnvVars: []string{"GF_PLUGIN_REPO"},
			},
			&cli.StringFlag{
				Name:    "pluginUrl",
				Usage:   "Full url to the plugin zip file instead of downloading the plugin from grafana.com/api",
				Value:   "",
				EnvVars: []string{"GF_PLUGIN_URL"},
			},
			&cli.BoolFlag{
				Name:  "insecure",
				Usage: "Skip TLS verification (insecure)",
			},
		},
		Subcommands: Commands,
		Before: func(c *cli.Context) error {
			// backward-compatible handling for cli version flag
			if c.Bool("version") {
				cli.ShowVersion(c)
				os.Exit(0)
			}

			logger.SetDebug(c.Bool("debug"))
			services.Init(version, c.Bool("insecure"), c.Bool("debug"))
			return nil
		},
	}
}

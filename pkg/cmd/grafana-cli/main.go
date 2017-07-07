package main

import (
	"fmt"
	"os"
	"runtime"

	"github.com/codegangsta/cli"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/log"
)

var version = "master"

func getGrafanaPluginDir() string {
	os := runtime.GOOS
	if os == "windows" {
		return "C:\\opt\\grafana\\plugins"
	} else {
		return "/var/lib/grafana/plugins"
	}
}

func main() {
	SetupLogging()

	app := cli.NewApp()
	app.Name = "Grafana cli"
	app.Usage = ""
	app.Author = "Grafana Project"
	app.Email = "https://github.com/grafana/grafana"
	app.Version = version
	app.Flags = []cli.Flag{
		cli.StringFlag{
			Name:   "pluginsDir",
			Usage:  "path to the grafana plugin directory",
			Value:  getGrafanaPluginDir(),
			EnvVar: "GF_PLUGIN_DIR",
		},
		cli.StringFlag{
			Name:   "repo",
			Usage:  "url to the plugin repository",
			Value:  "https://grafana.net/api/plugins",
			EnvVar: "GF_PLUGIN_REPO",
		},
		cli.BoolFlag{
			Name:  "debug, d",
			Usage: "enable debug logging",
		},
	}

	app.Commands = commands.Commands
	app.CommandNotFound = cmdNotFound

	if err := app.Run(os.Args); err != nil {
		log.Errorf("%v", err)
	}
}

func SetupLogging() {
	for _, f := range os.Args {
		if f == "-D" || f == "--debug" || f == "-debug" {
			log.SetDebug(true)
		}
	}
}

func cmdNotFound(c *cli.Context, command string) {
	fmt.Printf(
		"%s: '%s' is not a %s command. See '%s --help'.\n",
		c.App.Name,
		command,
		c.App.Name,
		os.Args[0],
	)
	os.Exit(1)
}

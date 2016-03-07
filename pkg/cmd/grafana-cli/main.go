package main

import (
	"fmt"
	"github.com/codegangsta/cli"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/log"
	"os"
	"runtime"
)

var version = "master"

func getGrafanaPluginPath() string {
	if os.Getenv("GF_PLUGIN_DIR") != "" {
		return os.Getenv("GF_PLUGIN_DIR")
	}

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
	app.Author = "raintank"
	app.Email = "https://github.com/grafana/grafana"
	app.Version = version
	app.Flags = []cli.Flag{
		cli.StringFlag{
			Name:  "path",
			Usage: "path to the grafana installation",
			Value: getGrafanaPluginPath(),
		},
		cli.StringFlag{
			Name:  "repo",
			Usage: "url to the plugin repository",
			Value: "https://raw.githubusercontent.com/grafana/grafana-plugin-repository/master/repo.json",
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

package main

import (
	"fmt"
	"os"

	"github.com/fatih/color"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/urfave/cli/v2"
)

var version = "master"

func main() {
	setupLogging()

	app := &cli.App{
		Name: "Grafana CLI",
		Authors: []*cli.Author{
			{
				Name:  "Grafana Project",
				Email: "hello@grafana.com",
			},
		},
		Version:         version,
		Flags:           commands.AppFlags,
		Commands:        commands.Commands,
		CommandNotFound: cmdNotFound,
	}

	app.Before = func(c *cli.Context) error {
		services.Init(version, c.Bool("insecure"))
		return nil
	}

	if err := app.Run(os.Args); err != nil {
		logger.Errorf("%s: %s %s\n", color.RedString("Error"), color.RedString("✗"), err)
		os.Exit(1)
	}
}

func setupLogging() {
	for _, f := range os.Args {
		if f == "-d" || f == "--debug" || f == "-debug" {
			logger.SetDebug(true)
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

package main

import (
	"fmt"
	"os"

	"github.com/fatih/color"
	"github.com/urfave/cli/v2"

	gcli "github.com/grafana/grafana/pkg/cmd/grafana-cli/commands"
	gsrv "github.com/grafana/grafana/pkg/cmd/grafana-server/commands"
	"github.com/grafana/grafana/pkg/cmd/grafana/apiserver"
)

// The following variables cannot be constants, since they can be overridden through the -X link flag
var version = "9.2.0"
var commit = gcli.DefaultCommitValue
var enterpriseCommit = gcli.DefaultCommitValue
var buildBranch = "main"
var buildstamp string

func main() {
	app := &cli.App{
		Name:  "grafana",
		Usage: "Grafana server and command line interface",
		Authors: []*cli.Author{
			{
				Name:  "Grafana Project",
				Email: "hello@grafana.com",
			},
		},
		Version: version,
		Commands: []*cli.Command{
			gcli.CLICommand(version),
			gsrv.ServerCommand(version, commit, enterpriseCommit, buildBranch, buildstamp),
			{
				// The kubernetes standalone apiserver service runner
				Name:  "apiserver",
				Usage: "run a standalone api service (experimental)",
				// Skip parsing flags because the command line is actually managed by cobra
				SkipFlagParsing: true,
				Action: func(context *cli.Context) error {
					// exit here because apiserver handles its own error output
					os.Exit(apiserver.RunCLI(gsrv.ServerOptions{
						Version:          version,
						Commit:           commit,
						EnterpriseCommit: enterpriseCommit,
						BuildBranch:      buildBranch,
						BuildStamp:       buildstamp,
						Context:          context,
					}))
					return nil
				},
			},
		},
		CommandNotFound:      cmdNotFound,
		EnableBashCompletion: true,
	}

	if err := app.Run(os.Args); err != nil {
		fmt.Printf("%s: %s %s\n", color.RedString("Error"), color.RedString("✗"), err)
		os.Exit(1)
	}

	os.Exit(0)
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

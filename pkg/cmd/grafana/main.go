package main

import (
	"fmt"
	"os"

	"github.com/fatih/color"
	"github.com/urfave/cli/v2"

	gcli "github.com/grafana/grafana/pkg/cmd/grafana-cli/commands"
	"github.com/grafana/grafana/pkg/cmd/grafana-server/commands"
	"github.com/grafana/grafana/pkg/extensions"
	_ "github.com/grafana/grafana/pkg/operators"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/server/bootstrap"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"

	// Registers the OSS dependency-injection entrypoints (server.InitializeAPIServerFactory etc.)
	// via bootstrap/wire's init(); without this side-effect import they are nil.
	_ "github.com/grafana/grafana/pkg/server/bootstrap/wire"
)

// The following variables cannot be constants, since they can be overridden through the -X link flag
var version = "9.2.0"
var commit = bootstrap.DefaultCommitValue
var enterpriseCommit = bootstrap.DefaultCommitValue
var buildBranch = "main"
var buildstamp string

func main() {
	app := MainApp()

	if err := app.Run(os.Args); err != nil {
		fmt.Printf("%s: %s %s\n", color.RedString("Error"), color.RedString("✗"), err)
		os.Exit(1)
	}

	os.Exit(0)
}

func MainApp() *cli.App {
	buildInfo := standalone.BuildInfo{
		Version:          version,
		Commit:           commit,
		EnterpriseCommit: enterpriseCommit,
		BuildBranch:      buildBranch,
		BuildStamp:       buildstamp,
	}

	// deps supplies the edition-specific injectors and metadata to the server
	// commands. server.Initialize / server.InitializeModuleServer are dispatched
	// to the OSS or enterprise Wire graph by build tag.
	deps := commands.ServerDeps{
		Initialize:       server.Initialize,
		ModuleInitialize: server.InitializeModuleServer,
		IsEnterprise:     extensions.IsEnterprise,
	}

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
			commands.ServerCommand(buildInfo, deps),
		},
		CommandNotFound:      cmdNotFound,
		EnableBashCompletion: true,
	}

	// Set the global build info
	bootstrap.SetBuildInfo(buildInfo, "", extensions.IsEnterprise)

	// Add the enterprise command line to build an api server
	f, err := server.InitializeAPIServerFactory()
	if err == nil {
		cmd := f.GetCLICommand(buildInfo)
		if cmd != nil {
			app.Commands = append(app.Commands, cmd)
		}
	}

	return app
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

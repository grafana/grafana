package commands

import (
	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/server/bootstrap"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
)

// ServerCommand returns the "server" CLI command. deps supplies the
// edition-specific server initializers and metadata; this package owns only the
// flags and subcommand structure, delegating startup to pkg/server/bootstrap.
func ServerCommand(buildInfo standalone.BuildInfo, deps ServerDeps) *cli.Command {
	return &cli.Command{
		Name:  "server",
		Usage: "run the grafana server",
		Flags: commonFlags,
		Action: func(context *cli.Context) error {
			return RunServer(buildInfo, deps, context)
		},
		Subcommands: []*cli.Command{TargetCommand(buildInfo, deps)},
	}
}

// RunServer maps the parsed CLI flags into a bootstrap.RunServerConfig and hands
// off to bootstrap, which owns the full server startup lifecycle.
func RunServer(buildInfo standalone.BuildInfo, deps ServerDeps, cliCtx *cli.Context) error {
	return bootstrap.RunServer(cliCtx.Context, bootstrap.RunServerConfig{
		Config:     bootstrapConfig(buildInfo, deps, cliCtx.Args().Slice()),
		Initialize: deps.Initialize,
	})
}

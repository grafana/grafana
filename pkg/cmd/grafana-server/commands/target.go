package commands

import (
	"context"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/server/bootstrap"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
)

// TargetCommand returns the "target" subcommand, which launches specific dskit
// modules. deps supplies the module-server initializer and metadata.
func TargetCommand(buildInfo standalone.BuildInfo, deps ServerDeps) *cli.Command {
	return &cli.Command{
		Name:  "target",
		Usage: "target specific grafana services",
		Flags: commonFlags,
		Action: func(context *cli.Context) error {
			return RunTargetServer(buildInfo, deps, context)
		},
	}
}

// RunTargetServer maps the parsed CLI flags into a bootstrap.RunTargetServerConfig
// and hands off to bootstrap. The target path uses a background context, matching
// the pre-delegation behavior.
func RunTargetServer(buildInfo standalone.BuildInfo, deps ServerDeps, cliCtx *cli.Context) error {
	return bootstrap.RunTargetServer(context.Background(), bootstrap.RunTargetServerConfig{
		Config:     bootstrapConfig(buildInfo, deps, cliCtx.Args().Slice()),
		Initialize: deps.ModuleInitialize,
	})
}

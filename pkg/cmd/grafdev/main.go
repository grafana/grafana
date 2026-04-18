package main

import (
	"fmt"
	"os"

	"github.com/grafana/grafana/pkg/cmd/grafdev/base"
	"github.com/grafana/grafana/pkg/cmd/grafdev/commands"
	"github.com/urfave/cli/v2"
)

func main() {
	deps := commands.Deps{
		Resolve: func(c *cli.Context) (base.RepoPaths, error) {
			return base.ResolveRepos(base.FromContext(c, "oss"), base.FromContext(c, "enterprise"))
		},
	}
	app := &cli.App{
		Name:     "grafdev",
		Usage:    "Prototype helper for Grafana OSS + grafana-enterprise local development",
		Flags:    base.GlobalPathFlags(),
		Commands: deps.All(),
	}
	if err := app.Run(os.Args); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(1)
	}
}

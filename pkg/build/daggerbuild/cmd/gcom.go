package cmd

import (
	"github.com/urfave/cli/v2"
)

var GCOMCommand = &cli.Command{
	Name:        "gcom",
	Description: "Executes requests to grafana.com",
	Subcommands: []*cli.Command{GCOMPublishCommand},
}

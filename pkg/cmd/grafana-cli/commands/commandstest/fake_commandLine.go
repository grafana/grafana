package commandstest

import (
	"flag"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/urfave/cli/v2"
)

// NewCliContext creates a new CLI context with a certain set of command line arguments.
func NewCliContext(args []string) (*utils.ContextCommandLine, error) {
	app := cli.App{
		Name: "Test",
	}
	flagSet := flag.NewFlagSet("Test", 0)
	if err := flagSet.Parse(args); err != nil {
		return nil, err
	}

	return &utils.ContextCommandLine{
		Context: cli.NewContext(&app, flagSet, nil),
	}, nil
}

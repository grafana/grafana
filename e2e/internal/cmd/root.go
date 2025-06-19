package cmd

import (
	"github.com/grafana/grafana/e2e/internal/cmd/a11y"
	"github.com/grafana/grafana/e2e/internal/cmd/cypress"
	"github.com/urfave/cli/v3"
)

func Root() *cli.Command {
	return &cli.Command{
		Name:  "e2e",
		Usage: "Run an end-to-end test suite",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "timezone",
				Usage: "Timezone to set for all containers (e.g. 'America/New_York')",
				Value: "Pacific/Honolulu",
			},
		},
		Commands: []*cli.Command{
			a11y.NewCmd(),
			cypress.NewCmd(),
		},
	}
}

package main

import (
	"log"
	"os"

	"github.com/urfave/cli/v2"
)

var additionalCommands []*cli.Command = make([]*cli.Command, 0, 5)

//nolint:unused
func registerAppCommand(c *cli.Command) {
	additionalCommands = append(additionalCommands, c)
}

func main() {
	app := cli.NewApp()
	app.Commands = cli.Commands{
		{
			Name:  "publish",
			Usage: "Publish packages to Grafana com and repositories",
			Subcommands: cli.Commands{
				{
					Name:   "grafana-com",
					Usage:  "Publish packages to grafana.com",
					Action: GrafanaCom,
					Flags: []cli.Flag{
						&editionFlag,
						&buildIDFlag,
						&dryRunFlag,
						&cli.StringFlag{
							Name:  "src-bucket",
							Value: "grafana-downloads",
							Usage: "Google Cloud Storage bucket",
						},
					},
				},
			},
		},
	}

	app.Commands = append(app.Commands, additionalCommands...)

	if err := app.Run(os.Args); err != nil {
		log.Fatalln(err)
	}
}

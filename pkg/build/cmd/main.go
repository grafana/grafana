package main

import (
	"log"
	"os"

	"github.com/urfave/cli/v2"
)

func main() {
	app := cli.NewApp()

	app.Commands = cli.Commands{
		{
			Name:      "build-backend",
			Usage:     "Build one or more variants of back-end binaries",
			ArgsUsage: "[version]",
			Action:    ArgCountWrapper(1, BuildBackend),
			Flags: []cli.Flag{
				&jobsFlag,
				&variantsFlag,
				&editionFlag,
				&buildIDFlag,
			},
		},
		{
			Name:      "build-frontend",
			Usage:     "Build front-end artifacts",
			ArgsUsage: "[version]",
			Action:    ArgCountWrapper(1, BuildFrontend),
			Flags: []cli.Flag{
				&jobsFlag,
				&editionFlag,
				&buildIDFlag,
				&noInstallDepsFlag,
			},
		},
	}

	if err := app.Run(os.Args); err != nil {
		log.Fatalln(err)
	}
}

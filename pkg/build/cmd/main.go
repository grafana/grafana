package main

import (
	"log"
	"os"
	"strings"

	"github.com/grafana/grafana/pkg/build/docker"
	"github.com/urfave/cli/v2"
)

func main() {
	app := cli.NewApp()
	app.Before = GenerateVersions
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
			},
		},
		{
			Name:   "build-docker",
			Usage:  "Build Grafana Docker images",
			Action: ArgCountWrapper(1, BuildDocker),
			Flags: []cli.Flag{
				&jobsFlag,
				&editionFlag,
				&cli.BoolFlag{
					Name:  "ubuntu",
					Usage: "Use Ubuntu base image",
				},
				&cli.BoolFlag{
					Name:  "shouldSave",
					Usage: "Should save docker image to tarball",
				},
				&cli.StringFlag{
					Name:  "archs",
					Value: strings.Join(docker.AllArchs, ","),
					Usage: "Comma separated architectures to build",
				},
			},
		},
		{
			Name:   "shellcheck",
			Usage:  "Run shellcheck on shell scripts",
			Action: Shellcheck,
		},
		{
			Name:   "build-plugins",
			Usage:  "Build internal plug-ins",
			Action: ArgCountWrapper(1, BuildInternalPlugins),
			Flags: []cli.Flag{
				&jobsFlag,
				&editionFlag,
				&signingAdminFlag,
				&signFlag,
				&noInstallDepsFlag,
			},
		},
	}

	if err := app.Run(os.Args); err != nil {
		log.Fatalln(err)
	}
}

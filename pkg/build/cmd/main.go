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
			Name:   "e2e-tests",
			Usage:  "Run Grafana e2e tests",
			Action: EndToEndTests,
			Flags: []cli.Flag{
				&triesFlag,
				&cli.IntFlag{
					Name:  "port",
					Value: 3001,
					Usage: "Specify the server port",
				},
				&cli.StringFlag{
					Name:  "suite",
					Usage: "Specify the end-to-end tests suite to be used",
				},
				&cli.StringFlag{
					Name:  "host",
					Value: "grafana-server",
					Usage: "Specify the server host",
				},
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

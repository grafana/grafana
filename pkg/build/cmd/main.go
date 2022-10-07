package main

import (
	"log"
	"os"
	"strings"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/grafana/grafana/pkg/build/docker"
	"github.com/grafana/grafana/pkg/build/packaging"
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
			Name:      "build-frontend-packages",
			Usage:     "Build front-end packages",
			ArgsUsage: "[version]",
			Action:    BuildFrontendPackages,
			Flags: []cli.Flag{
				&jobsFlag,
				&editionFlag,
				&buildIDFlag,
				&noInstallDepsFlag,
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
		{
			Name:      "publish-metrics",
			Usage:     "Publish a set of metrics from stdin",
			ArgsUsage: "<api-key>",
			Action:    ArgCountWrapper(1, PublishMetrics),
		},
		{
			Name:   "verify-drone",
			Usage:  "Verify Drone configuration",
			Action: VerifyDrone,
		},
		{
			Name:   "export-version",
			Usage:  "Exports version in dist/grafana.version",
			Action: ExportVersion,
		},
		{
			Name:      "package",
			Usage:     "Package one or more Grafana variants",
			ArgsUsage: "[version]",
			Action:    ArgCountWrapper(1, Package),
			Flags: []cli.Flag{
				&jobsFlag,
				&variantsFlag,
				&editionFlag,
				&buildIDFlag,
				&signFlag,
			},
		},
		{
			Name:   "store-storybook",
			Usage:  "Integrity check for storybook build",
			Action: StoreStorybook,
			Flags: []cli.Flag{
				&cli.StringFlag{
					Name:  "deployment",
					Usage: "Kind of deployment (e.g. canary/latest)",
				},
			},
		},
		{
			Name:  "artifacts",
			Usage: "Handle Grafana artifacts",
			Subcommands: cli.Commands{
				{
					Name:  "docker",
					Usage: "Handle Grafana Docker images",
					Subcommands: cli.Commands{
						{
							Name:      "fetch",
							Usage:     "Fetch Grafana Docker images",
							ArgsUsage: "[version]",
							Action:    ArgCountWrapper(1, FetchImages),
							Flags: []cli.Flag{
								&editionFlag,
							},
						},
					},
				},
			},
		},
		{
			Name:  "publish",
			Usage: "Publish packages to Grafana com and repositories",
			Subcommands: cli.Commands{
				{
					Name:      "packages",
					Usage:     "publish Grafana packages",
					ArgsUsage: "[version]",
					Action:    PublishPackages,
					Flags: []cli.Flag{
						&jobsFlag,
						&editionFlag,
						&buildIDFlag,
						&dryRunFlag,
						&gcpKeyFlag,
						&cli.StringFlag{
							Name:  "packages-bucket",
							Value: config.PublicBucket,
							Usage: "Google Cloud Storage Debian database bucket",
						},
						&cli.StringFlag{
							Name:  "deb-db-bucket",
							Value: packaging.DefaultDebDBBucket,
							Usage: "Google Cloud Storage Debian database bucket",
						},
						&cli.StringFlag{
							Name:  "deb-repo-bucket",
							Value: packaging.DefaultDebRepoBucket,
							Usage: "Google Cloud Storage Debian repo bucket",
						},
						&cli.StringFlag{
							Name:  "rpm-repo-bucket",
							Value: packaging.DefaultRPMRepoBucket,
							Usage: "Google Cloud Storage RPM repo bucket",
						},
						&cli.StringFlag{
							Name:  "ttl",
							Value: packaging.DefaultTTLSeconds,
							Usage: "Cache time to live for uploaded packages",
						},
						&cli.BoolFlag{
							Name:  "simulate-release",
							Usage: "Only simulate creating release at grafana.com",
						},
					},
				},
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

	if err := app.Run(os.Args); err != nil {
		log.Fatalln(err)
	}
}

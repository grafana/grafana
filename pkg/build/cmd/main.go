package main

import (
	"log"
	"os"
	"strings"

	"github.com/urfave/cli/v2"

	"github.com/grafana/grafana/pkg/build/docker"
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
			Name:      "build-backend",
			Usage:     "Build one or more variants of back-end binaries",
			ArgsUsage: "[version]",
			Action:    MaxArgCountWrapper(1, BuildBackend),
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
				&cli.StringFlag{
					Name:  "video",
					Value: "true",
					Usage: "Specify if videos should be recorded",
				},
			},
		},
		{
			Name:      "build-frontend",
			Usage:     "Build front-end artifacts",
			ArgsUsage: "[version]",
			Action:    MaxArgCountWrapper(1, BuildFrontend),
			Flags: []cli.Flag{
				&jobsFlag,
				&editionFlag,
				&buildIDFlag,
			},
		},
		{
			Name:   "build-docker",
			Usage:  "Build Grafana Docker images",
			Action: MaxArgCountWrapper(1, BuildDocker),
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
			Name:   "upload-cdn",
			Usage:  "Upload public/* to a cdn bucket",
			Action: UploadCDN,
			Flags: []cli.Flag{
				&editionFlag,
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
			Action: MaxArgCountWrapper(1, BuildInternalPlugins),
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
			Action:    MaxArgCountWrapper(1, PublishMetrics),
		},
		{
			Name:   "verify-drone",
			Usage:  "Verify Drone configuration",
			Action: VerifyDrone,
		},
		{
			Name:      "verify-starlark",
			Usage:     "Verify Starlark configuration",
			ArgsUsage: "<workspace path>",
			Action:    VerifyStarlark,
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
			Action:    MaxArgCountWrapper(1, Package),
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
			Usage:  "Stores storybook to GCS buckets",
			Action: StoreStorybook,
			Flags: []cli.Flag{
				&cli.StringFlag{
					Name:  "deployment",
					Usage: "Kind of deployment (e.g. canary/latest)",
				},
			},
		},
		{
			Name:   "verify-storybook",
			Usage:  "Integrity check for storybook build",
			Action: VerifyStorybook,
		},
		{
			Name:   "upload-packages",
			Usage:  "Upload Grafana packages",
			Action: UploadPackages,
			Flags: []cli.Flag{
				&jobsFlag,
				&editionFlag,
				&cli.BoolFlag{
					Name:  "enterprise2",
					Usage: "Declare if the edition is enterprise2",
				},
			},
		},
		{
			Name:  "artifacts",
			Usage: "Handle Grafana artifacts",
			Subcommands: cli.Commands{
				{
					Name:   "storybook",
					Usage:  "Publish Grafana storybook",
					Action: PublishStorybookAction,
					Flags: []cli.Flag{
						&editionFlag,
						&tagFlag,
						&srcFlag,
						&cli.StringFlag{
							Name:  "storybook-bucket",
							Value: "grafana-storybook",
							Usage: "Google Cloud Storage bucket for storybooks",
						},
					},
				},
				{
					Name:   "static-assets",
					Usage:  "Publish Grafana static assets",
					Action: PublishStaticAssetsAction,
					Flags: []cli.Flag{
						&editionFlag,
						&securityFlag,
						&securityDestBucketFlag,
						&tagFlag,
						&srcFlag,
						&destFlag,
						&cli.StringFlag{
							Name:  "static-assets-bucket",
							Value: "grafana-static-assets",
							Usage: "Google Cloud Storage bucket for static assets",
						},
						&cli.StringSliceFlag{
							Name:  "static-asset-editions",
							Usage: "All the editions of the static assets (or $STATIC_ASSET_EDITIONS)",
						},
					},
				},
				{
					Name:   "packages",
					Usage:  "Publish Grafana packages",
					Action: PublishArtifactsAction,
					Flags: []cli.Flag{
						&editionFlag,
						&securityFlag,
						&securityDestBucketFlag,
						&tagFlag,
						&srcFlag,
						&destFlag,
						&cli.StringSliceFlag{
							Name:  "artifacts-editions",
							Value: cli.NewStringSlice("oss", "enterprise", "enterprise2"),
							Usage: "Editions for which the artifacts should be delivered (oss,enterprise,enterprise2), (or $ARTIFACTS_EDITIONS)",
						},
						&cli.StringFlag{
							Name:  "enterprise2-dest-bucket",
							Value: "grafana-downloads-enterprise2",
							Usage: "Google Cloud Storage bucket for published packages",
						},
						&cli.StringFlag{
							Name:  "enterprise2-security-prefix",
							Usage: "Bucket path prefix for enterprise2 security releases (or $ENTERPRISE2_SECURITY_PREFIX)",
						},
					},
				},
				{
					Name:  "docker",
					Usage: "Handle Grafana Docker images",
					Subcommands: cli.Commands{
						{
							Name:      "fetch",
							Usage:     "Fetch Grafana Docker images",
							ArgsUsage: "[version]",
							Action:    MaxArgCountWrapper(1, FetchImages),
							Flags: []cli.Flag{
								&editionFlag,
							},
						},
						{
							Name:      "publish-enterprise2",
							Usage:     "Handle Grafana Enterprise2 Docker images",
							ArgsUsage: "[version]",
							Action:    Enterprise2,
							Flags: []cli.Flag{
								&cli.StringFlag{
									Name:  "dockerhub-repo",
									Usage: "DockerHub repo to push images",
								},
							},
						},
					},
				},
				{
					Name:  "npm",
					Usage: "Handle Grafana npm packages",
					Subcommands: cli.Commands{
						{
							Name:      "release",
							Usage:     "Release npm packages",
							ArgsUsage: "[version]",
							Action:    NpmReleaseAction,
							Flags: []cli.Flag{
								&tagFlag,
							},
						},
						{
							Name:   "store",
							Usage:  "Store npm packages tarball",
							Action: NpmStoreAction,
							Flags: []cli.Flag{
								&tagFlag,
							},
						},
						{
							Name:   "retrieve",
							Usage:  "Retrieve npm packages tarball",
							Action: NpmRetrieveAction,
							Flags: []cli.Flag{
								&tagFlag,
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
				{
					Name:   "github",
					Usage:  "Publish packages to GitHub releases",
					Action: PublishGithub,
					Flags: []cli.Flag{
						&dryRunFlag,
						&cli.StringFlag{
							Name:  "path",
							Usage: "Path to the asset to be published",
						},
						&cli.StringFlag{
							Name:     "repo",
							Required: true,
							Usage:    "GitHub repository",
						},
						&cli.StringFlag{
							Name:  "tag",
							Usage: "Release tag (default from metadata)",
						},
						&cli.BoolFlag{
							Name:  "create",
							Usage: "Create release if it doesn't exist",
						},
					},
				},
				{
					Name:   "aws",
					Usage:  "Publish image to AWS Marketplace releases",
					Action: PublishAwsMarketplace,
					Flags: []cli.Flag{
						&dryRunFlag,
						&cli.StringFlag{
							Name:  "version",
							Usage: "Release version (default from metadata)",
						},
						&cli.StringFlag{
							Name:     "image",
							Required: true,
							Usage:    "Name of the image to be released",
						},
						&cli.StringFlag{
							Name:     "repo",
							Required: true,
							Usage:    "AWS Marketplace ECR repository",
						},
						&cli.StringFlag{
							Name:     "product",
							Required: true,
							Usage:    "AWS Marketplace product identifier",
						},
					},
				},
			},
		},
		{
			Name:  "enterprise-check",
			Usage: "Commands for testing against Grafana Enterprise",
			Subcommands: cli.Commands{
				{
					Name:   "begin",
					Usage:  "Creates the GitHub check in a pull request and begins the tests",
					Action: EnterpriseCheckBegin,
					Flags: []cli.Flag{
						&gitHubTokenFlag,
					},
				},
				{
					Name:   "success",
					Usage:  "Updates the GitHub check in a pull request to show a successful build and updates the pull request labels",
					Action: EnterpriseCheckSuccess,
					Flags: []cli.Flag{
						&gitHubTokenFlag,
					},
				},
				{
					Name:   "fail",
					Usage:  "Updates the GitHub check in a pull request to show a failed build and updates the pull request labels",
					Action: EnterpriseCheckFail,
					Flags: []cli.Flag{
						&gitHubTokenFlag,
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

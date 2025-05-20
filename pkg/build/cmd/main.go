package main

import (
	"log"
	"os"

	"github.com/grafana/grafana/pkg/build/cmd/util"
	"github.com/grafana/grafana/pkg/build/daggerbuild/cmd"
	"github.com/urfave/cli/v2"
)

var additionalCommands []*cli.Command = make([]*cli.Command, 0, 5)

//nolint:unused
func registerAppCommand(c *cli.Command) {
	additionalCommands = append(additionalCommands, c)
}

func main() {
	// TODO change the registerer if the user is running using a JSON file etc
	for k, v := range cmd.Artifacts {
		if err := cmd.GlobalCLI.Register(k, v); err != nil {
			panic(err)
		}
	}

	app := cmd.GlobalCLI.App()
	artifactsCommand := cmd.GlobalCLI.ArtifactsCommand()
	artifactsCommand.Subcommands = cli.Commands{
		{
			Name:   "storybook",
			Usage:  "[ARCHIVED] Publish Grafana storybook",
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
			Usage:  "[ARCHIVED] Publish Grafana static assets",
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
			Usage:  "[ARCHIVED] Publish Grafana packages",
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
			Usage: "[ARCHIVED] Handle Grafana Docker images",
			Subcommands: cli.Commands{
				{
					Name:      "fetch",
					Usage:     "Fetch Grafana Docker images",
					ArgsUsage: "[version]",
					Action:    util.MaxArgCountWrapper(1, FetchImages),
					Flags: []cli.Flag{
						&editionFlag,
					},
				},
			},
		},
		{
			Name:  "npm",
			Usage: "[ARCHIVED] Handle Grafana npm packages",
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
	}
	app.Commands = append(app.Commands, []*cli.Command{
		{
			Name:   "e2e-tests",
			Usage:  "[ARCHIVED] Run Grafana e2e tests",
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
			Name:   "upload-cdn",
			Usage:  "[ARCHIVED] Upload public/* to a cdn bucket",
			Action: UploadCDN,
			Flags: []cli.Flag{
				&editionFlag,
			},
		},
		{
			Name:      "publish-metrics",
			Usage:     "[ARCHIVED] Publish a set of metrics from stdin",
			ArgsUsage: "<api-key>",
			Action:    util.MaxArgCountWrapper(1, PublishMetrics),
		},
		{
			Name:   "verify-drone",
			Usage:  "[ARCHIVED] Verify Drone configuration",
			Action: VerifyDrone,
		},
		{
			Name:   "store-storybook",
			Usage:  "[ARCHIVED] Stores storybook to GCS buckets",
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
			Usage:  "[ARCHIVED] Integrity check for storybook build",
			Action: VerifyStorybook,
		},
		{
			Name:   "upload-packages",
			Usage:  "[ARCHIVED] Upload Grafana packages",
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
		artifactsCommand,
		{
			Name:  "publish",
			Usage: "[ARCHIVED] Publish packages to Grafana com and repositories",
			Subcommands: cli.Commands{
				{
					Name:   "grafana-com",
					Usage:  "Publish packages to grafana.com",
					Action: GrafanaCom,
					Flags: []cli.Flag{
						&editionFlag,
						&buildIDFlag,
						&util.DryRunFlag,
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
						&util.DryRunFlag,
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
						&util.DryRunFlag,
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
	}...)

	app.Commands = append(app.Commands, additionalCommands...)

	if err := app.Run(os.Args); err != nil {
		log.Fatalln(err)
	}
}

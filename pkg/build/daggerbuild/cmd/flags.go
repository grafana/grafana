package cmd

import (
	"github.com/grafana/grafana/pkg/build/daggerbuild/arguments"
	"github.com/grafana/grafana/pkg/build/daggerbuild/cmd/flags"
	"github.com/urfave/cli/v2"
)

var FlagPackage = &cli.StringSliceFlag{
	Name:  "package",
	Usage: "Path to a grafana.tar.gz package used as input. This command will process each package provided separately and produce an equal number of applicable outputs",
}
var FlagNameOverride = &cli.StringFlag{
	Name:  "name",
	Usage: "Overrides any calculation for name in the package with the value provided here",
}

// PackageInputFlags are used for commands that require a grafana package as input.
// These commands are exclusively used outside of the CI process and are typically used in the CD process where a grafana.tar.gz has already been created.
var PackageInputFlags = []cli.Flag{
	FlagPackage,
	FlagNameOverride,
}

// GCPFlags are used in commands that need to authenticate with Google Cloud platform using the Google Cloud SDK
var GCPFlags = []cli.Flag{
	&cli.StringFlag{
		Name:  "gcp-service-account-key-base64",
		Usage: "Provides a service-account key encoded in base64 to use to authenticate with the Google Cloud SDK",
	},
	&cli.StringFlag{
		Name:  "gcp-service-account-key",
		Usage: "Provides a service-account keyfile to use to authenticate with the Google Cloud SDK. If not provided or is empty, then $XDG_CONFIG_HOME/gcloud will be mounted in the container",
	},
}

// NPMFlags are used in commands that need to authenticate with package registries to publish NPM packages
var NPMFlags = []cli.Flag{
	&cli.StringFlag{
		Name:  "registry",
		Usage: "The package registry to publish packages",
		Value: "registry.npmjs.org",
	},
	&cli.StringFlag{
		Name:     "token",
		Usage:    "Provides a token to use to authenticate with the package registry",
		Required: true,
	},
	&cli.StringSliceFlag{
		Name:     "tag",
		Usage:    "Provides the tags to use when publishing packages",
		Required: true,
	},
}

// PublishFlags are flags that are used in commands that create artifacts.
// Anything that creates an artifact should have the option to specify a local folder destination or a remote destination.
var PublishFlags = flags.PublishFlags

// GrafanaFlags are flags that are required when working with the grafana source code.
var GrafanaFlags = []cli.Flag{
	&cli.BoolFlag{
		Name:     "grafana",
		Usage:    "If set, initialize Grafana",
		Required: false,
		Value:    true,
	},
	&cli.StringFlag{
		Name:     "grafana-dir",
		Usage:    "Local Grafana dir to use, instead of git clone",
		Required: false,
	},
	&cli.StringFlag{
		Name:     "grafana-repo",
		Usage:    "Grafana repo to clone, not valid if --grafana-dir is set",
		Required: false,
		Value:    "https://github.com/grafana/grafana.git",
	},
	&cli.StringFlag{
		Name:     "grafana-ref",
		Usage:    "Grafana ref to clone, not valid if --grafana-dir is set",
		Required: false,
		Value:    "main",
	},
	&cli.BoolFlag{
		Name:  "enterprise",
		Usage: "If set, initialize Grafana Enterprise",
		Value: false,
	},
	&cli.StringFlag{
		Name:     "enterprise-dir",
		Usage:    "Local Grafana Enterprise dir to use, instead of git clone",
		Required: false,
	},
	&cli.StringFlag{
		Name:     "enterprise-repo",
		Usage:    "Grafana Enterprise repo to clone, not valid if --grafana-dir is set",
		Required: false,
		Value:    "https://github.com/grafana/grafana-enterprise.git",
	},
	&cli.StringFlag{
		Name:     "enterprise-ref",
		Usage:    "Grafana Enterprise ref to clone, not valid if --enterprise-dir is set",
		Required: false,
		Value:    "main",
	},
	&cli.StringFlag{
		Name:     "github-token",
		Usage:    "Github token to use for git cloning, by default will be pulled from GitHub",
		Required: false,
	},
	&cli.StringSliceFlag{
		Name:    "env",
		Aliases: []string{"e"},
		Usage:   "Set a build-time environment variable using the same syntax as 'docker run'. Example: `--env=GOOS=linux --env=GOARCH=amd64`",
	},
	&cli.StringSliceFlag{
		Name:  "go-tags",
		Usage: "Sets the go `-tags` flag when compiling the backend",
	},
	&cli.StringFlag{
		Name:     "go-version",
		Usage:    "The version of Go to be used for building the Grafana backend",
		Required: false,
		Value:    "1.21.8",
	},
	&cli.StringFlag{
		Name:  "yarn-cache",
		Usage: "If there is a yarn cache directory, then mount that when running 'yarn install' instead of creating a cache directory",
	},
}

// DockerFlags are used when producing docker images.
var DockerFlags = []cli.Flag{
	arguments.DockerRegistryFlag,
	arguments.AlpineImageFlag,
	arguments.UbuntuImageFlag,
	arguments.TagFormatFlag,
	arguments.UbuntuTagFormatFlag,
	arguments.DockerOrgFlag,
}

var DockerPublishFlags = []cli.Flag{
	&cli.StringFlag{
		Name:     "username",
		Usage:    "The username to login to the docker registry when publishing images",
		Required: true,
	},
	&cli.StringFlag{
		Name:     "password",
		Usage:    "The password to login to the docker registry when publishing images",
		Required: true,
	},
	&cli.StringFlag{
		Name:  "repo",
		Usage: "Overrides the repository of the images",
	},
	&cli.BoolFlag{
		Name:  "latest",
		Usage: "Tags the published images as latest",
	},
}

var FlagDistros = &cli.StringSliceFlag{
	Name:  "distro",
	Usage: "See the list of distributions with 'go tool dist list'. For variations of the same distribution, like 'armv6' or 'armv7', append an extra path part. Example: 'linux/arm/v6', or 'linux/amd64/v3'",
	Value: cli.NewStringSlice(flags.DefaultDistros...),
}

var ConcurrencyFlags = flags.ConcurrencyFlags

// PackageFlags are flags that are used when building packages or similar artifacts (like binaries) for different distributions
// from the grafana source code.
var PackageFlags = []cli.Flag{
	FlagDistros,
	&cli.StringFlag{
		Name:  "edition",
		Usage: "Simply alters the naming of the '.tar.gz' package. The string set will override the '-{flavor}' part of the package name",
	},
}

var ProImageFlags = []cli.Flag{
	&cli.StringFlag{
		Name:     "github-token",
		Usage:    "Github token to use for git cloning, by default will be pulled from GitHub",
		Required: false,
	},
	&cli.StringFlag{
		Name:     "grafana-repo",
		Usage:    "The Grafana repository",
		Required: false,
		Value:    "https://github.com/grafana/grafana",
	},
	&cli.StringFlag{
		Name:     "grafana-version",
		Usage:    "The Grafana version",
		Required: true,
	},
	&cli.StringFlag{
		Name:     "repo",
		Usage:    "The docker image repo",
		Value:    "hosted-grafana-pro",
		Required: false,
	},
	&cli.StringFlag{
		Name:     "image-tag",
		Usage:    "The docker image tag",
		Required: true,
	},
	&cli.StringFlag{
		Name:  "release-type",
		Usage: "The Grafana release type",
		Value: "prerelease",
	},
	&cli.BoolFlag{
		Name:  "push",
		Usage: "Push the built image to the container registry",
		Value: false,
	},
	&cli.StringFlag{
		Name:  "registry",
		Usage: "The container registry that the image should be pushed to. Required if --push is set.",
		Value: "docker.io",
	},
}

var GCOMFlags = []cli.Flag{
	&cli.StringFlag{
		Name:  "api-url",
		Usage: "API URL used in requests to grafana.com",
		Value: "https://grafana.com/api/grafana",
	},
	&cli.StringFlag{
		Name:     "api-key",
		Usage:    "API Key used in requests to grafana.com",
		Required: true,
	},
	&cli.StringFlag{
		Name:     "download-url",
		Usage:    "URL used to download packages from grafana.com",
		Required: true,
	},
	&cli.BoolFlag{
		Name:  "beta",
		Usage: "Use when publishing a beta version",
	},
	&cli.BoolFlag{
		Name:  "nightly",
		Usage: "Use when publishing a nightly version",
	},
}

// JoinFlags combines several slices of flags into one slice of flags.
var JoinFlags = flags.Join

func JoinFlagsWithDefault(f ...[]cli.Flag) []cli.Flag {
	// Kind of gross but ensures that DefaultFlags are registered before any others.
	return JoinFlags(append([][]cli.Flag{flags.DefaultFlags}, f...)...)
}

// package pipelines has functions and types that orchestrate containers.
package pipelines

import (
	"context"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/cliutil"
	"github.com/grafana/grafana/pkg/build/daggerbuild/containers"
	"github.com/grafana/grafana/pkg/build/daggerbuild/docker"
	"github.com/grafana/grafana/pkg/build/daggerbuild/gcom"
	"github.com/grafana/grafana/pkg/build/daggerbuild/gpg"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type PipelineFunc func(context.Context, *dagger.Client, *dagger.Directory, PipelineArgs) error
type PipelineFuncWithPackageInput func(context.Context, *dagger.Client, PipelineArgs) error

func DockerOptsFromFlags(c cliutil.CLIContext) *docker.DockerOpts {
	return &docker.DockerOpts{
		Registry:        c.String("registry"),
		AlpineBase:      c.String("alpine-base"),
		UbuntuBase:      c.String("ubuntu-base"),
		Username:        c.String("username"),
		Password:        c.String("password"),
		Org:             c.String("org"),
		Repository:      c.String("repo"),
		Latest:          c.Bool("latest"),
		TagFormat:       c.String("tag-format"),
		UbuntuTagFormat: c.String("ubuntu-tag-format"),
	}
}

type ConcurrencyOpts struct {
	Parallel int64
}

func ConcurrencyOptsFromFlags(c cliutil.CLIContext) *ConcurrencyOpts {
	return &ConcurrencyOpts{
		Parallel: c.Int64("parallel"),
	}
}

type PipelineArgs struct {
	// These arguments are ones that are available at the global level.
	Verbose bool

	// Platform, where applicable, specifies what platform (linux/arm64, for example) to run the dagger containers on.
	// This should really only be used if you know what you're doing. misusing this flag can result in really slow builds.
	// Some example scenarios where you might want to use this:
	// * You're on linux/amd64 and you're building a docker image for linux/armv7 or linux/arm64
	// * You're on linux/arm64 and you're building a package for linux/arm64
	Platform dagger.Platform

	// Context is available for all sub-commands that define their own flags.
	Context cliutil.CLIContext

	// GrafanaOpts will be populated if the GrafanaFlags are enabled on the current sub-command.
	// GrafanaOpts *containers.GrafanaOpts

	// PackageOpts will be populated if the PackageFlags are enabled on the current sub-command.
	// PackageOpts *containers.PackageOpts

	// PublishOpts will be populated if the PublishFlags flags are enabled on the current sub-command
	// This is set for pipelines that publish artifacts.
	PublishOpts *containers.PublishOpts

	// PackageInputOpts will be populated if the PackageInputFlags are enabled on current sub-command.
	// This is set for pipelines that accept a package as input.
	PackageInputOpts *containers.PackageInputOpts
	GPGOpts          *gpg.GPGOpts
	DockerOpts       *docker.DockerOpts
	GCPOpts          *containers.GCPOpts
	ConcurrencyOpts  *ConcurrencyOpts

	// ProImageOpts will be populated if ProImageFlags are enabled on the current sub-command.
	ProImageOpts *containers.ProImageOpts

	// NPMOpts will be populated if NPMFlags are enabled on the current sub-command.
	NpmToken    string
	NpmRegistry string
	NpmTags     []string

	// GCOMOpts will be populated if GCOMFlags are enabled on the current sub-command.
	GCOMOpts *gcom.GCOMOpts
}

// PipelineArgsFromContext populates a pipelines.PipelineArgs from a CLI context.
func PipelineArgsFromContext(ctx context.Context, c cliutil.CLIContext) (PipelineArgs, error) {
	// Global flags
	var (
		verbose  = c.Bool("v")
		platform = c.String("platform")
	)
	// grafanaOpts, err := containers.GrafanaOptsFromFlags(ctx, c)
	// if err != nil {
	// 	return PipelineArgs{}, err
	// }
	gcomOpts, err := gcom.GCOMOptsFromFlags(c)
	if err != nil {
		return PipelineArgs{}, err
	}

	return PipelineArgs{
		Context:  c,
		Verbose:  verbose,
		Platform: dagger.Platform(platform),
		// GrafanaOpts:      grafanaOpts,
		GPGOpts: &gpg.GPGOpts{},
		// PackageOpts:      containers.PackageOptsFromFlags(c),
		PublishOpts:      containers.PublishOptsFromFlags(c),
		PackageInputOpts: containers.PackageInputOptsFromFlags(c),
		DockerOpts:       DockerOptsFromFlags(c),
		GCPOpts:          containers.GCPOptsFromFlags(c),
		ConcurrencyOpts:  ConcurrencyOptsFromFlags(c),
		ProImageOpts:     containers.ProImageOptsFromFlags(c),
		GCOMOpts:         gcomOpts,
		NpmToken:         c.String("token"),
		NpmRegistry:      c.String("registry"),
		NpmTags:          c.StringSlice("tag"),
	}, nil
}

// InjectPipelineArgsIntoSpan is used to copy some of the arguments passed to
// the pipeline into a top-level OpenTelemtry span. Fields that might contain
// secrets are left out.
func InjectPipelineArgsIntoSpan(span trace.Span, args PipelineArgs) {
	attributes := make([]attribute.KeyValue, 0, 10)
	attributes = append(attributes, attribute.String("platform", string(args.Platform)))
	// if args.GrafanaOpts != nil {
	// 	attributes = append(attributes, attribute.String("go-version", args.GrafanaOpts.GoVersion))
	// 	attributes = append(attributes, attribute.String("version", args.GrafanaOpts.Version))
	// 	attributes = append(attributes, attribute.String("grafana-dir", args.GrafanaOpts.GrafanaDir))
	// 	attributes = append(attributes, attribute.String("grafana-ref", args.GrafanaOpts.GrafanaRef))
	// 	attributes = append(attributes, attribute.String("enterprise-dir", args.GrafanaOpts.EnterpriseDir))
	// 	attributes = append(attributes, attribute.String("enterprise-ref", args.GrafanaOpts.EnterpriseRef))
	// }
	// if args.PackageOpts != nil {
	// 	distros := []string{}
	// 	for _, distro := range args.PackageOpts.Distros {
	// 		distros = append(distros, string(distro))
	// 	}
	// 	attributes = append(attributes, attribute.StringSlice("package-distros", distros))
	// }
	span.SetAttributes(attributes...)
}

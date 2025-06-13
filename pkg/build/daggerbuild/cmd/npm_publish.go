package cmd

import (
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipelines"
	"github.com/urfave/cli/v2"
)

var PublishNPMCommand = &cli.Command{
	Name:   "publish",
	Action: PipelineActionWithPackageInput(pipelines.PublishNPM),
	Usage:  "Using a grafana.tar.gz as input (ideally one built using the 'package' command), take the npm artifacts and publish them on NPM.",
	Flags: JoinFlagsWithDefault(
		PackageInputFlags,
		NPMFlags,
		GCPFlags,
		ConcurrencyFlags,
	),
}

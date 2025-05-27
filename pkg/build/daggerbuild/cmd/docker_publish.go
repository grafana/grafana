package cmd

import (
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipelines"
	"github.com/urfave/cli/v2"
)

var DockerPublishCommand = &cli.Command{
	Name:   "publish",
	Action: PipelineActionWithPackageInput(pipelines.PublishDocker),
	Usage:  "Using a grafana.docker.tar.gz as input (ideally one built using the 'package' command), publish a docker image and manifest",
	Flags: JoinFlagsWithDefault(
		PackageInputFlags,
		DockerFlags,
		DockerPublishFlags,
		GCPFlags,
		ConcurrencyFlags,
	),
}

package cmd

import (
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipelines"
	"github.com/urfave/cli/v2"
)

var ProImageCommand = &cli.Command{
	Name:        "pro-image",
	Action:      PipelineActionWithPackageInput(pipelines.ProImage),
	Description: "Creates a hosted grafana pro image",
	Flags:       JoinFlagsWithDefault(ProImageFlags, GCPFlags, PackageInputFlags),
}

package flags

import "github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"

var (
	Ubuntu             pipeline.FlagOption = "docker-ubuntu"
	DockerRepositories pipeline.FlagOption = "docker-repos"
)

var DockerFlags = []pipeline.Flag{
	{
		Name: "ubuntu",
		Options: map[pipeline.FlagOption]any{
			Ubuntu: true,
		},
	},
}

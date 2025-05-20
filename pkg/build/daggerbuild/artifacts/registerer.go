package artifacts

import "github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"

type Initializer struct {
	InitializerFunc pipeline.ArtifactInitializer
	Arguments       []pipeline.Argument
}

type Registerer interface {
	Register(string, Initializer) error
	Initializers() map[string]Initializer
}

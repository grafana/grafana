package containers

import (
	"dagger.io/dagger"
)

type Env struct {
	Name  string
	Value string
}

func EnvVar(name, value string) Env {
	return Env{Name: name, Value: value}
}

func WithEnv(c *dagger.Container, env []Env) *dagger.Container {
	container := c
	for _, v := range env {
		container = container.WithEnvVariable(v.Name, v.Value)
	}

	return container
}

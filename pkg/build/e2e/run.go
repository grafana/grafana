package main

import (
	"fmt"

	"dagger.io/dagger"
)

func RunSuite(d *dagger.Client, svc *dagger.Service, src *dagger.Directory, cache *dagger.CacheVolume, suite string) *dagger.Container {
	return WithYarnCache(WithGrafanaFrontend(d.Container().From("cypress/included:13.1.0"), src), cache).
		WithWorkdir("/src").
		WithEnvVariable("HOST", "grafana").
		WithEnvVariable("PORT", "3001").
		WithServiceBinding("grafana", svc).
		WithExec([]string{"yarn", "install", "--immutable"}).
		WithExec([]string{
			"/bin/bash", "-c",
			fmt.Sprintf("./e2e/run-suite %s true", suite),
		}, dagger.ContainerWithExecOpts{
			Expect: dagger.ReturnTypeAny,
		})
}

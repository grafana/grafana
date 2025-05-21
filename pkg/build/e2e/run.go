package main

import (
	"fmt"

	"dagger.io/dagger"
)

func RunSuite(d *dagger.Client, svc *dagger.Service, src *dagger.Directory, cache *dagger.CacheVolume, runMode, suite, runnerFlags string) *dagger.Container {
	command := fmt.Sprintf(
		"./e2e-runner --start-grafana=false --cypress-video"+
			" --suite %s %s", suite, runnerFlags)

	return WithYarnCache(WithGrafanaFrontend(d.Container().From("cypress/included:13.1.0"), src), cache).
		WithWorkdir("/src").
		WithEnvVariable("HOST", "grafana").
		WithEnvVariable("PORT", "3001").
		WithServiceBinding("grafana", svc).
		WithExec([]string{"yarn", "install", "--immutable"}).
		WithExec([]string{"/bin/bash", "-c", command}, dagger.ContainerWithExecOpts{Expect: dagger.ReturnTypeAny})
}

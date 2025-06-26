package main

import (
	"fmt"

	"dagger.io/dagger"
)

func RunSuite(d *dagger.Client, svc *dagger.Service, src *dagger.Directory, cache *dagger.CacheVolume, suite, runnerFlags string) *dagger.Container {
	command := fmt.Sprintf(
		"./e2e-runner cypress --start-grafana=false --cypress-video"+
			" --grafana-base-url http://grafana:3001 --suite %s %s", suite, runnerFlags)

	return WithYarnCache(WithGrafanaFrontend(d.Container().From("cypress/included:13.1.0"), src), cache).
		WithWorkdir("/src").
		WithServiceBinding("grafana", svc).
		WithExec([]string{"yarn", "install", "--immutable"}).
		WithExec([]string{"/bin/bash", "-c", command}, dagger.ContainerWithExecOpts{Expect: dagger.ReturnTypeAny})
}

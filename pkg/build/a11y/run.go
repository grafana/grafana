package main

import (
	"fmt"

	"dagger.io/dagger"
)

func RunTest(
	d *dagger.Client,
	svc *dagger.Service,
	src *dagger.Directory, cache *dagger.CacheVolume,
	nodeVersion, runnerFlags string) *dagger.Container {
	command := fmt.Sprintf(
		"./e2e-runner a11y --start-grafana=false"+
			" --grafana-base-url http://grafana:3001 %s", runnerFlags)

	return GrafanaFrontend(d, cache, nodeVersion, src).
		WithWorkdir("/src").
		WithServiceBinding("grafana", svc).
		WithExec([]string{"/bin/bash", "-c", command}, dagger.ContainerWithExecOpts{Expect: dagger.ReturnTypeAny})
}

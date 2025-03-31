package main

import (
	"fmt"

	"dagger.io/dagger"
)

func RunSuiteVideos(d *dagger.Client, svc *dagger.Service, src *dagger.Directory, cache *dagger.CacheVolume, suite string) *dagger.Directory {
	return WithYarnCache(WithGrafanaFrontend(d.Container().From("cypress/included:13.1.0"), src), cache).
		WithWorkdir("/src").
		WithEnvVariable("HOST", "grafana").
		WithEnvVariable("PORT", "3001").
		WithServiceBinding("grafana", svc).
		WithExec([]string{"yarn", "install", "--immutable"}).
		WithExec([]string{"/bin/bash", "-c", fmt.Sprintf("./e2e/run-suite %s true || true", suite)}).
		Directory(fmt.Sprintf("/src/e2e/%s/videos", suite))
}

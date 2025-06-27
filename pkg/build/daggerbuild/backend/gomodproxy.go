package backend

import (
	"os"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/containers"
	"github.com/grafana/grafana/pkg/build/daggerbuild/golang"
)

// withInheritedEnv will inherit the specific environment variables (env) from the host in the container (c)
func withInheritedEnv(c *dagger.Container, vars []string) *dagger.Container {
	container := c
	for _, key := range vars {
		value, ok := os.LookupEnv(key)
		if !ok {
			continue
		}

		container = container.WithEnvVariable(key, value)
	}

	return container
}

func WithGoModProxy(
	d *dagger.Client,
	platform dagger.Platform,
	c *dagger.Container,
	goVersion string,
	goCacheVolume *dagger.CacheVolume,
) *dagger.Container {
	svc := WithGoCachePlugin(golang.Container(d, platform, goVersion), platform)

	svc = containers.WithEnv(svc, []containers.Env{
		{
			Name:  "GOCACHE_HTTP",
			Value: "0.0.0.0:12345",
		}, {
			Name:  "GOCACHE_MODPROXY",
			Value: "true",
		}, {
			Name:  "GOCACHE_PLUGIN",
			Value: "0.0.0.0:1234",
		}, {
			Name:  "GOCACHE_METRICS",
			Value: "true",
		}, {
			Name:  "GOCACHE_DIR",
			Value: "/tmp/gocache",
		},
	})

	svc = svc.WithMountedCache("/tmp/gocache", goCacheVolume)
	svc = withInheritedEnv(svc, []string{"GOCACHE_S3_BUCKET", "GOCACHE_S3_REGION"})
	s := svc.WithExposedPort(1234).WithExposedPort(12345).AsService(dagger.ContainerAsServiceOpts{
		Args: []string{"go-cache-plugin", "serve", "-v"},
	})

	return c.WithFile("/bin/go-cache-plugin", svc.File("/bin/go-cache-plugin")).
		WithEnvVariable("GOPROXY", "http://localhost:12345/mod").
		WithEnvVariable("GOSUMDB", "sum.golang.org http://localhost:12345/mod/sumdb/sum.golang.org").
		WithEnvVariable("GOCACHEPROG", `go-cache-plugin connect gocache:1234`).
		WithServiceBinding("gocache", s)
}

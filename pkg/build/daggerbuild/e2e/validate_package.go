package e2e

import (
	"context"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/e2eutil"
)

func ValidatePackage(ctx context.Context, d *dagger.Client, service *dagger.Service, src *dagger.Directory, yarnCacheVolume *dagger.CacheVolume, nodeVersion string) (*dagger.Container, error) {
	c, err := e2eutil.WithFrontendContainer(ctx, d, src)
	if err != nil {
		return nil, err
	}

	return c.WithServiceBinding("grafana", service).
		WithEnvVariable("GRAFANA_URL", "http://grafana:3000").
		WithExec([]string{"yarn", "e2e:acceptance"}), nil
}

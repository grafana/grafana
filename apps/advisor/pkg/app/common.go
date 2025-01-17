package app

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
)

type checkRegisterer interface {
	New(cfg *AdvisorConfig) check
	Kind() resource.Kind
}

type check interface {
	Run(ctx context.Context, obj resource.Object) (resource.Object, error)
}

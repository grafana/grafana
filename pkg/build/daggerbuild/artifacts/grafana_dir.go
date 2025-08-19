package artifacts

import (
	"context"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/arguments"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
)

func GrafanaDir(ctx context.Context, state pipeline.StateHandler, enterprise bool) (*dagger.Directory, error) {
	if enterprise {
		return state.Directory(ctx, arguments.EnterpriseDirectory)
	}
	return state.Directory(ctx, arguments.GrafanaDirectory)
}

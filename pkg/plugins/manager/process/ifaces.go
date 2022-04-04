package process

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

type Service interface {
	Start(ctx context.Context, p *plugins.Plugin) error
	Stop(ctx context.Context, p *plugins.Plugin) error
	Shutdown(ctx context.Context)
}

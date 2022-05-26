package process

import (
	"context"
)

type Service interface {
	Start(ctx context.Context, pluginID string) error
	Stop(ctx context.Context, pluginID string) error
	Shutdown(ctx context.Context)
}

package ssosettings

import (
	"context"

	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
)

type Service interface {
	GetAll(ctx context.Context, requester identity.Requester) ([]*models.SSOSetting, error)
	GetForProvider(ctx context.Context, provider string, strategy FallbackStrategy) (*models.SSOSetting, error)
	Upsert(ctx context.Context, provider string, data map[string]interface{}) error
	Delete(ctx context.Context, provider string) error

	Reload(ctx context.Context, provider string)
	RegisterReloadable(ctx context.Context, provider string, reloadable Reloadable)
}

// Reloadable is an interface that can be implemented by a provider to allow
type Reloadable interface {
	Reload(ctx context.Context) error
}

type Validateable[T any] interface {
	Validate(ctx context.Context, input T) error
}

type FallbackStrategy interface {
	ParseConfigFromSystem(ctx context.Context) (map[string]interface{}, error)
}

type Store interface {
	Get(ctx context.Context, provider string) (*models.SSOSetting, error)
	Upsert(ctx context.Context, provider string, data map[string]interface{}) error
	Patch(ctx context.Context, provider string, data map[string]interface{}) error
	Delete(ctx context.Context, provider string) error
}

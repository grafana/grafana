package folder

import (
	"context"

	"github.com/grafana/grafana/pkg/services/user"
)

type RegistryService interface {
	DeleteInFolder(ctx context.Context, orgID int64, uid string) error
	CountInFolder(ctx context.Context, orgID int64, uid string, user *user.SignedInUser) (int64, error)
	Kind() string
}

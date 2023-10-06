package folder

import (
	"context"

	"github.com/grafana/grafana/pkg/services/auth/identity"
)

type RegistryService interface {
	DeleteInFolder(ctx context.Context, orgID int64, folderUID string, user identity.Requester) error
	CountInFolder(ctx context.Context, orgID int64, folderUID string, user identity.Requester) (int64, error)
	Kind() string
}

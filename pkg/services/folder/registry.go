package folder

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type RegistryService interface {
	DeleteInFolders(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) error
	CountInFolders(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) (int64, error)
	Kind() string
}

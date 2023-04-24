package folder

import (
	"context"
)

type RegistryService interface {
	DeleteInFolder(ctx context.Context, orgID int64, UID string) error
	Kind() string
}

package folder

import (
	"context"
)

type RegistryEntityService interface {
	DeleteInFolder(ctx context.Context, orgID int64, UID string) error
	Kind() string
}

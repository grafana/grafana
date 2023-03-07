package registryentity

import (
	"context"
)

// TODO rethink the naming (also
// make sure directory and file naming matches go conventions)
type RegistryEntityService interface {
	DeleteForRegistry(ctx context.Context, orgID int64, UID string) error
	Kind() string
}

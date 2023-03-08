package registryentity

import (
	"context"
)

// TODO rethink the naming (also
// make sure directory and file naming matches go conventions);
// avoid "entity" since this already has associations
type RegistryEntityService interface {
	DeleteInFolder(ctx context.Context, orgID int64, UID string) error
	Kind() string
}

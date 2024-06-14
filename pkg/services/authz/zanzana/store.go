package zanzana

import (
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/memory"
)

// FIXME(kalleep): Add support for postgres, mysql and sqlite data stores
// Postgres and mysql is already imlemented by open fga so we need to add an implementation
// for sqlite3. We could contribute that one upstream
func NewStore() storage.OpenFGADatastore {
	return memory.New()
}

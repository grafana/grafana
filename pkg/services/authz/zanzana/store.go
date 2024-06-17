package zanzana

import (
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/memory"
)

// FIXME(kalleep): Add support for postgres, mysql and sqlite data stores.
// Postgres and mysql is already implmented by openFGA so we just need to hook up migartions for them.
// There is no support for sqlite atm but we are working on adding it: https://github.com/openfga/openfga/pull/1615
func NewStore() storage.OpenFGADatastore {
	return memory.New()
}

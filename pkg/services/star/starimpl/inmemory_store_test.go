package starimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestInmemory(t *testing.T) {
	testIntegrationUserStarsDataAccess(t, func(_ *sqlstore.SQLStore) store {
		return newInmemory()
	})
}

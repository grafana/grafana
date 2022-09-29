package starimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func TestIntegrationXormUserStarsDataAccess(t *testing.T) {
	testIntegrationUserStarsDataAccess(t, func(ss *sqlstore.SQLStore) store {
		return &sqlStore{db: ss}
	})
}

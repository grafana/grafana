package prefimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
)

func TestIntegrationXORMPreferencesDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testIntegrationPreferencesDataAccess(t, func(ss db.DB) store {
		return &sqlStore{db: ss}
	})
}

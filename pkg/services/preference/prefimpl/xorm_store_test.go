package prefimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
)

func TestIntegrationXORMPreferencesDataAccess(t *testing.T) {
	testIntegrationPreferencesDataAccess(t, func(ss db.DB) store {
		return &sqlStore{db: ss}
	})
}

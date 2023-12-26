package apikeyimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
)

func TestIntegrationXORMApiKeyDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testIntegrationApiKeyDataAccess(t, func(ss db.DB) store {
		return &sqlStore{db: ss}
	})
}

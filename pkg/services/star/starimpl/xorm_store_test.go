package starimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
)

func TestIntegrationXormUserStarsDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	testIntegrationUserStarsDataAccess(t, func(ss db.DB) store {
		return &sqlStore{db: ss}
	})
}

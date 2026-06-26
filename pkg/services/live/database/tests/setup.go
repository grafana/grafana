package tests

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/live/database"
)

// SetupTestStorage initializes a storage to used by the integration tests.
// This is required to properly register and execute migrations.
func SetupTestStorage(t *testing.T) *database.Storage {
	sqlStore := db.InitTestDB(t)
	localCache := localcache.New(time.Hour, time.Hour)
	return database.NewStorage(sqlStore, localCache)
}

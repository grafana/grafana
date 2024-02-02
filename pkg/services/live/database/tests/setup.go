package tests

import (
	"os"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/live/database"
)

func TestMain(m *testing.M) {
	code := m.Run()
	db.CleanupTestDB()
	os.Exit(code)
}

// SetupTestStorage initializes a storage to used by the integration tests.
// This is required to properly register and execute migrations.
func SetupTestStorage(t *testing.T) *database.Storage {
	sqlStore := db.InitTestDB(t)
	localCache := localcache.New(time.Hour, time.Hour)
	return database.NewStorage(sqlStore, localCache)
}

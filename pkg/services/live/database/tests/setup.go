package tests

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/live/database"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

// SetupTestStorage initializes a storage to used by the integration tests.
// This is required to properly register and execute migrations.
func SetupTestStorage(t *testing.T) *database.Storage {
	cfg := setting.NewCfg()
	// Live is disabled by default and only if it's enabled its database migrations run
	// and the related database tables are created.
	cfg.FeatureToggles = map[string]bool{"live": true}

	gLive := live.NewGrafanaLive()
	gLive.Cfg = cfg

	// Hook for initialising the service after the Cfg is populated
	// so that database migrations will run.
	overrideServiceFunc := func(descriptor registry.Descriptor) (*registry.Descriptor, bool) {
		if _, ok := descriptor.Instance.(*live.GrafanaLive); ok {
			return &registry.Descriptor{
				Name:         descriptor.Name,
				Instance:     gLive,
				InitPriority: descriptor.InitPriority,
			}, true
		}
		return nil, false
	}
	registry.RegisterOverride(overrideServiceFunc)

	// Now we can use sql.Store.
	sqlStore := sqlstore.InitTestDB(t)
	localCache := localcache.New(time.Hour, time.Hour)
	return database.NewStorage(sqlStore, localCache)
}

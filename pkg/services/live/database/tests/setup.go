package tests

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/live/database"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

// SetupTestMessageStorage initializes a storage to used by the integration tests.
// This is required to properly register and execute migrations.
func SetupTestMessageStorage(t *testing.T) *database.MessageStorage {
	cfg := setting.NewCfg()
	// Live is disabled by default and only if it's enabled its database migrations run
	// and the related database tables are created.
	cfg.FeatureToggles = map[string]bool{"live-config": true}

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
	return database.NewMessageStorage(sqlStore, localCache)
}

// SetupTestChannelRuleStorage initializes a storage to used by the integration tests.
// This is required to properly register and execute migrations.
func SetupTestChannelRuleStorage(t *testing.T) *database.ChannelRuleStorage {
	cfg := setting.NewCfg()
	// Live is disabled by default and only if it's enabled its database migrations run
	// and the related database tables are created.
	cfg.FeatureToggles = map[string]bool{"live-config": true}

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
	s, err := database.NewChannelRuleStorage(sqlStore)
	require.NoError(t, err)
	return s
}

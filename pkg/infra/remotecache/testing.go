package remotecache

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/setting"
)

// NewFakeStore creates store for testing
func NewFakeStore(t *testing.T) *RemoteCache {
	t.Helper()

	opts := &setting.RemoteCacheSettings{
		Name:    "database",
		ConnStr: "",
	}

	sqlStore := db.InitTestDB(t)

	dc, err := ProvideService(&setting.Cfg{
		RemoteCacheOptions: opts,
	}, sqlStore, &usagestats.UsageStatsMock{}, fakes.NewFakeSecretsService())
	require.NoError(t, err, "Failed to init remote cache for test")

	return dc
}

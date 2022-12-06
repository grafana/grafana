package remotecache

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

// NewFakeStore creates store for testing
func NewFakeStore(t *testing.T) *RemoteCache {
	t.Helper()

	opts := &setting.RemoteCacheOptions{
		Name:    "database",
		ConnStr: "",
	}

	sqlStore := sqlstore.InitTestDB(t)

	dc, err := ProvideService(&setting.Cfg{
		RemoteCacheOptions: opts,
	}, sqlStore, fakes.NewFakeSecretsService())
	require.NoError(t, err, "Failed to init remote cache for test")

	return dc
}

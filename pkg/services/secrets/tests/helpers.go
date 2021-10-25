package tests

import (
	"testing"

	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/services/encryption/ossencryption"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"

	"gopkg.in/ini.v1"
)

func SetupTestServiceWithDB(tb testing.TB, db *sqlstore.SQLStore) *secretsManager.SecretsService {
	tb.Helper()
	defaultKey := "SdlklWklckeLS"
	if len(setting.SecretKey) > 0 {
		defaultKey = setting.SecretKey
	}
	raw, err := ini.Load([]byte(`
		[security]
		secret_key = ` + defaultKey))
	require.NoError(tb, err)
	settings := &setting.OSSImpl{Cfg: &setting.Cfg{Raw: raw}}

	return secretsManager.ProvideSecretsService(
		database.ProvideSecretsStore(db),
		bus.New(),
		ossencryption.ProvideService(),
		settings,
	)
}

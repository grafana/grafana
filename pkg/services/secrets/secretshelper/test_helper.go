package secretshelper

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/secrets"

	"github.com/grafana/grafana/pkg/services/secrets/database"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/services/encryption/ossencryption"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func SetupTestService(t *testing.T) secrets.SecretsService {
	t.Helper()
	defaultKey := "SdlklWklckeLS"
	if len(setting.SecretKey) > 0 {
		defaultKey = setting.SecretKey
	}
	raw, err := ini.Load([]byte(`
		[security]
		secret_key = ` + defaultKey))
	require.NoError(t, err)
	settings := &setting.OSSImpl{Cfg: &setting.Cfg{Raw: raw}}

	return secrets.ProvideSecretsService(
		database.ProvideSecretsStore(sqlstore.InitTestDB(t)),
		bus.New(),
		ossencryption.ProvideService(),
		settings,
	)
}

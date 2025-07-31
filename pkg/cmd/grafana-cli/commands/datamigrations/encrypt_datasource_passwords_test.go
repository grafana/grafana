package datamigrations

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/commands/commandstest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationPasswordMigrationCommand(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	// setup datasources with password, basic_auth and none
	store := db.InitTestDB(t)
	err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
		passwordMigration(t, sess, store)
		return nil
	})
	require.NoError(t, err)
}

func passwordMigration(t *testing.T, session *db.Session, sqlstore db.DB) {
	ds := []*datasources.DataSource{
		{Type: "influxdb", Name: "influxdb", Password: "foobar", UID: "influx"},
		{Type: "graphite", Name: "graphite", BasicAuthPassword: "foobar", UID: "graphite"},
		{Type: "prometheus", Name: "prometheus", UID: "prom"},
		{Type: "elasticsearch", Name: "elasticsearch", Password: "pwd", UID: "elastic"},
	}

	// set required default values
	for _, ds := range ds {
		ds.Created = time.Now()
		ds.Updated = time.Now()

		cfg := setting.NewCfg()

		if ds.Name == "elasticsearch" {
			key, err := util.Encrypt([]byte("value"), cfg.SecretKey)
			require.NoError(t, err)

			ds.SecureJsonData = map[string][]byte{"key": key}
		} else {
			ds.SecureJsonData = map[string][]byte{}
		}
	}

	_, err := session.Insert(&ds)
	require.NoError(t, err)

	// force secure_json_data to be null to verify that migration can handle that
	_, err = session.Exec("update data_source set secure_json_data = null where name = 'influxdb'")
	require.NoError(t, err)

	// run migration
	c, err := commandstest.NewCliContext(map[string]string{})
	require.Nil(t, err)
	err = EncryptDatasourcePasswords(c, setting.ProvideService(setting.NewCfg()), sqlstore)
	require.NoError(t, err)

	// verify that no datasources still have password or basic_auth
	var dss []*datasources.DataSource
	err = session.SQL("select * from data_source").Find(&dss)
	require.NoError(t, err)
	assert.Equal(t, len(dss), 4)

	for _, ds := range dss {
		cfg := setting.NewCfg()
		sj, err := DecryptSecureJsonData(cfg.SecretKey, ds)
		require.NoError(t, err)

		if ds.Name == "influxdb" {
			assert.Equal(t, ds.Password, "")
			v, exist := sj["password"]
			assert.True(t, exist)
			assert.Equal(t, v, "foobar", "expected password to be moved to securejson")
		}

		if ds.Name == "graphite" {
			assert.Equal(t, ds.BasicAuthPassword, "")
			v, exist := sj["basicAuthPassword"]
			assert.True(t, exist)
			assert.Equal(t, v, "foobar", "expected basic_auth_password to be moved to securejson")
		}

		if ds.Name == "prometheus" {
			assert.Equal(t, len(sj), 0)
		}

		if ds.Name == "elasticsearch" {
			assert.Equal(t, ds.Password, "")
			key, exist := sj["key"]
			assert.True(t, exist)
			password, exist := sj["password"]
			assert.True(t, exist)
			assert.Equal(t, password, "pwd", "expected password to be moved to securejson")
			assert.Equal(t, key, "value", "expected existing key to be kept intact in securejson")
		}
	}
}

func DecryptSecureJsonData(secretKey string, ds *datasources.DataSource) (map[string]string, error) {
	decrypted := make(map[string]string)
	for key, data := range ds.SecureJsonData {
		decryptedData, err := util.Decrypt(data, secretKey)
		if err != nil {
			return nil, err
		}

		decrypted[key] = string(decryptedData)
	}
	return decrypted, nil
}

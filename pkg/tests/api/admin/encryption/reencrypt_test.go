package encryption

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegration_AdminApiReencrypt(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const (
		dataSourceTable              = "data_source"
		secretsTable                 = "secrets"
		secretsValueColumn           = "value"
		alertmanagerSecureSettingKey = "secure-value"
		secureJsonKey                = "db-secure-key"
	)

	getSecretsFunctions := map[string]func(*testing.T, *server.TestEnv) map[int]secret{}
	getSecretsFunctions["secureJson-"+dataSourceTable] = func(t *testing.T, env *server.TestEnv) map[int]secret {
		return getSecureJsonSecrets(t, env.SQLStore, dataSourceTable, secureJsonKey)
	}
	getSecretsFunctions["base64-"+secretsTable+"-"+secretsValueColumn] = func(t *testing.T, env *server.TestEnv) map[int]secret {
		return getBase64Secrets(t, env.SQLStore, secretsTable, secretsValueColumn, base64.RawStdEncoding)
	}
	getSecretsFunctions["alertmanager"] = func(t *testing.T, env *server.TestEnv) map[int]secret {
		return getAlertmanagerSecrets(t, env.SQLStore, alertmanagerSecureSettingKey)
	}
	getSecretsFunctions["signing_keys"] = func(t *testing.T, env *server.TestEnv) map[int]secret {
		return getSigningKeys(t, env.SQLStore)
	}

	setup := func(t *testing.T, env *server.TestEnv, grafanaListenAddr string) {
		dsCmd := &datasources.AddDataSourceCommand{
			Name:            "TestDatasource",
			Type:            "testdata",
			Access:          datasources.DS_ACCESS_DIRECT,
			UID:             "testuid",
			UserID:          1,
			OrgID:           1,
			WithCredentials: true,
			SecureJsonData: map[string]string{
				secureJsonKey: "db-secure-value",
			},
		}
		// This creates secret both in `data_source` table and `secrets` table.
		_, err := env.Server.HTTPServer.DataSourcesService.AddDataSource(context.Background(), dsCmd)
		require.NoError(t, err)

		// Trigger creation of signing key
		_, _, err = env.IDService.SignIdentity(context.Background(), &authn.Identity{ID: "1", Type: claims.TypeUser})
		require.NoError(t, err)

		// Add alerting config with secure settings.
		addAlertingConfig(t, env)
	}

	RunAdminApiReencryptTest(t, setup, getSecretsFunctions)
}

// This test verifies that secrets in various databases are reencrypted with new data key when reencryption is triggered.
// Setup function is supposed to create various secrets that are then
// obtained via "secretsFunctions".
// This test is quite generic so that it can be called from enterprise repository as well.
func RunAdminApiReencryptTest(
	t *testing.T,
	setup func(t *testing.T, env *server.TestEnv, grafanaListenAddr string),
	secretsFns map[string]func(t *testing.T, env *server.TestEnv) map[int]secret,
) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		APIServerStorageType: options.StorageTypeUnified,
	})

	grafanaListenAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	setup(t, env, grafanaListenAddr)

	beforeReencrypt := getSecrets(t, secretsFns, env)

	err := env.Server.HTTPServer.SecretsService.RotateDataKeys(context.Background())
	require.NoError(t, err)

	// Reencrypt with new data key.
	ok, err := env.Server.HTTPServer.SecretsMigrator.ReEncryptSecrets(context.Background())
	require.NoError(t, err)
	assert.True(t, ok, "Failed to reencrypt all secrets")

	afterReencrypt := getSecrets(t, secretsFns, env)
	verifyAllSecrets(t, env, beforeReencrypt, afterReencrypt)

	// Rollback from envelope to legacy encryption.
	ok, err = env.Server.HTTPServer.SecretsMigrator.RollBackSecrets(context.Background())
	require.NoError(t, err)
	assert.True(t, ok, "Failed to rollback all secrets")

	afterRollback := getSecrets(t, secretsFns, env)
	verifyAllSecrets(t, env, afterReencrypt, afterRollback)
}

func getSecrets(t *testing.T, secretsFunctions map[string]func(t *testing.T, env *server.TestEnv) map[int]secret, env *server.TestEnv) map[string]map[int]secret {
	secrets := map[string]map[int]secret{}
	for name, fn := range secretsFunctions {
		s := fn(t, env)
		require.NotEmpty(t, s, "Failed to get secrets from function %s", name)
		secrets[name] = s
	}
	return secrets
}

func getAlertmanagerSecrets(t *testing.T, store db.DB, secureSettingKey string) map[int]secret {
	var rows []struct {
		Id                        int
		AlertmanagerConfiguration string
	}
	err := store.WithDbSession(t.Context(), func(sess *db.Session) error {
		return sess.Table("alert_configuration").Cols("id", "alertmanager_configuration").Find(&rows)
	})
	require.NoError(t, err)

	result := map[int]secret{}

next:
	for _, r := range rows {
		postableUserConfig, err := notifier.Load([]byte(r.AlertmanagerConfiguration))
		require.NoError(t, err)

		// Find first grafana-managed receiver config with secure settings with given key, and extract it.
		for _, receiver := range postableUserConfig.AlertmanagerConfig.Receivers {
			for _, gmr := range receiver.GrafanaManagedReceivers {
				v := gmr.SecureSettings[secureSettingKey]
				if v == "" {
					continue
				}

				decoded, err := base64.StdEncoding.DecodeString(v)
				require.NoError(t, err)
				result[r.Id] = secret{
					id:     r.Id,
					secret: decoded,
				}
				continue next
			}
		}
	}
	return result
}

func addAlertingConfig(t *testing.T, env *server.TestEnv) {
	// Create alertmanager config
	cfg := apimodels.PostableUserConfig{}
	body := `
		{
			"alertmanager_config": {
				"route": {
					"receiver": "grafana-default-email"
				},
				"receivers": [{
					"name": "grafana-default-email",
					"grafana_managed_receiver_configs": [{
						"uid": "",
						"name": "email receiver",
						"type": "email",
						"isDefault": true,
						"settings": {
							"addresses": "<example@email.com>"
						},
						"secureSettings": {
							"secure-value": "secret"
						}
					}]
				}]
			}
		}
		`
	err := json.Unmarshal([]byte(body), &cfg)
	require.NoError(t, err)
	err = env.Server.HTTPServer.AlertNG.MultiOrgAlertmanager.SaveAndApplyAlertmanagerConfiguration(context.Background(), 1, cfg)
	require.NoError(t, err)
}

type secret struct {
	id     int
	secret []byte
	update time.Time
}

func verifyAllSecrets(t *testing.T, env *server.TestEnv, before, after map[string]map[int]secret) {
	require.Equal(t, len(before), len(after))
	for k, bef := range before {
		aft, ok := after[k]
		require.True(t, ok)
		verifySecrets(t, env, bef, aft)
	}
}

func verifySecrets(t *testing.T, env *server.TestEnv, before, after map[int]secret) {
	require.Equal(t, len(before), len(after))
	for k, bef := range before {
		aft, ok := after[k]
		require.True(t, ok, "key not found: %d", k)

		require.NotEmpty(t, bef.secret, "before secret is empty for key %d", k)
		require.NotEmpty(t, aft.secret, "after secret is empty for key %d", k)
		require.NotEqual(t, bef.secret, aft.secret, "secrets are equal after reencrypt for key %d", k)

		s1, err := env.Server.HTTPServer.SecretsService.Decrypt(context.Background(), bef.secret)
		require.NoError(t, err)
		s2, err := env.Server.HTTPServer.SecretsService.Decrypt(context.Background(), aft.secret)
		require.NoError(t, err)
		assert.Equal(t, string(s1), string(s2), "decrypted secrets are not equal for key %d", k)

		updatedDiff := aft.update.Sub(bef.update)
		// Since we're storing timestamps with seconds resolution, diff can be 0.
		require.True(t, 0 <= updatedDiff && updatedDiff <= time.Minute, "Updated time difference (%v) outside of allowed range for key %d", updatedDiff, k)
	}
}

func getSecureJsonSecrets(t *testing.T, store db.DB, table string, secureJsonDataKey string) map[int]secret {
	var rows []struct {
		Id             int
		SecureJsonData map[string][]byte
		Updated        time.Time
	}

	err := store.WithDbSession(t.Context(), func(sess *db.Session) error {
		return sess.Table(table).Cols("id", "secure_json_data", "updated").Find(&rows)
	})
	require.NoError(t, err)

	result := map[int]secret{}
	for _, r := range rows {
		result[r.Id] = secret{
			id:     r.Id,
			secret: r.SecureJsonData[secureJsonDataKey],
			update: r.Updated,
		}
	}
	return result
}

func getBase64Secrets(t *testing.T, store db.DB, table, column string, enc *base64.Encoding) map[int]secret {
	var rows []struct {
		Id      int
		Secret  string
		Updated time.Time
	}

	err := store.WithDbSession(t.Context(), func(sess *db.Session) error {
		return sess.Table(table).Select(fmt.Sprintf("id, %s as secret, updated", column)).Find(&rows)
	})
	require.NoError(t, err)

	result := map[int]secret{}
	for _, r := range rows {
		d, err := enc.DecodeString(r.Secret)
		require.NoError(t, err)
		result[r.Id] = secret{
			id:     r.Id,
			secret: d,
			update: r.Updated,
		}
	}
	return result
}

func getSigningKeys(t *testing.T, store db.DB) map[int]secret {
	var rows []struct {
		Id int
		Pk string
	}

	err := store.WithDbSession(t.Context(), func(sess *db.Session) error {
		return sess.Table("signing_key").Select("id, private_key as pk").Find(&rows)
	})
	require.NoError(t, err)

	result := map[int]secret{}
	for _, r := range rows {
		d, err := base64.RawStdEncoding.DecodeString(r.Pk)
		require.NoError(t, err)
		result[r.Id] = secret{
			id:     r.Id,
			secret: d,
			// there's no update time, leave it at 0
		}
	}
	return result
}

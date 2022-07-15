package migrator

import (
	"context"
	"encoding/base64"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type SecretsMigrator struct {
	encryptionSrv encryption.Internal
	secretsSrv    *manager.SecretsService
	sqlStore      *sqlstore.SQLStore
	settings      setting.Provider
}

func ProvideSecretsMigrator(
	encryptionSrv encryption.Internal,
	service *manager.SecretsService,
	sqlStore *sqlstore.SQLStore,
	settings setting.Provider,
) *SecretsMigrator {
	return &SecretsMigrator{
		encryptionSrv: encryptionSrv,
		secretsSrv:    service,
		sqlStore:      sqlStore,
		settings:      settings,
	}
}

func (m *SecretsMigrator) ReEncryptSecrets(ctx context.Context) error {
	toReencrypt := []interface {
		reencrypt(context.Context, *manager.SecretsService, *sqlstore.SQLStore)
	}{
		simpleSecret{tableName: "dashboard_snapshot", columnName: "dashboard_encrypted"},
		b64Secret{simpleSecret: simpleSecret{tableName: "user_auth", columnName: "o_auth_access_token"}, encoding: base64.StdEncoding},
		b64Secret{simpleSecret: simpleSecret{tableName: "user_auth", columnName: "o_auth_refresh_token"}, encoding: base64.StdEncoding},
		b64Secret{simpleSecret: simpleSecret{tableName: "user_auth", columnName: "o_auth_token_type"}, encoding: base64.StdEncoding},
		b64Secret{simpleSecret: simpleSecret{tableName: "secrets", columnName: "value"}, hasUpdatedColumn: true, encoding: base64.RawStdEncoding},
		jsonSecret{tableName: "data_source"},
		jsonSecret{tableName: "plugin_setting"},
		alertingSecret{},
	}

	for _, r := range toReencrypt {
		r.reencrypt(ctx, m.secretsSrv, m.sqlStore)
	}

	return nil
}

func (m *SecretsMigrator) RollBackSecrets(ctx context.Context) error {
	toRollback := []interface {
		rollback(context.Context, *manager.SecretsService, encryption.Internal, *sqlstore.SQLStore, string) bool
	}{
		simpleSecret{tableName: "dashboard_snapshot", columnName: "dashboard_encrypted"},
		b64Secret{simpleSecret: simpleSecret{tableName: "user_auth", columnName: "o_auth_access_token"}, encoding: base64.StdEncoding},
		b64Secret{simpleSecret: simpleSecret{tableName: "user_auth", columnName: "o_auth_refresh_token"}, encoding: base64.StdEncoding},
		b64Secret{simpleSecret: simpleSecret{tableName: "user_auth", columnName: "o_auth_token_type"}, encoding: base64.StdEncoding},
		b64Secret{simpleSecret: simpleSecret{tableName: "secrets", columnName: "value"}, hasUpdatedColumn: true, encoding: base64.RawStdEncoding},
		jsonSecret{tableName: "data_source"},
		jsonSecret{tableName: "plugin_setting"},
		alertingSecret{},
	}

	var anyFailure bool

	for _, r := range toRollback {
		if failed := r.rollback(ctx,
			m.secretsSrv,
			m.encryptionSrv,
			m.sqlStore,
			m.settings.KeyValue("security", "secret_key").Value(),
		); failed {
			anyFailure = true
		}
	}

	if anyFailure {
		logger.Warn("Some errors happened, not cleaning up data keys table...")
		return nil
	}

	if _, sqlErr := m.sqlStore.NewSession(ctx).Exec("DELETE FROM data_keys"); sqlErr != nil {
		logger.Warn("Error while cleaning up data keys table...", "error", sqlErr)
	}

	return nil
}

type simpleSecret struct {
	tableName  string
	columnName string
}

type b64Secret struct {
	simpleSecret
	hasUpdatedColumn bool
	encoding         *base64.Encoding
}

type jsonSecret struct {
	tableName string
}

type alertingSecret struct{}

func nowInUTC() string {
	return time.Now().UTC().Format("2006-01-02 15:04:05")
}

var logger = log.New("secrets.migrations")

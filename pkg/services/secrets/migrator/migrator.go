package migrator

import (
	"context"
	"encoding/base64"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
)

type SecretsMigrator struct {
	encryptionSrv encryption.Internal
	secretsSrv    *manager.SecretsService
	sqlStore      db.DB
	settings      setting.Provider
	features      featuremgmt.FeatureToggles
}

func ProvideSecretsMigrator(
	encryptionSrv encryption.Internal,
	service *manager.SecretsService,
	sqlStore db.DB,
	settings setting.Provider,
	features featuremgmt.FeatureToggles,
) *SecretsMigrator {
	return &SecretsMigrator{
		encryptionSrv: encryptionSrv,
		secretsSrv:    service,
		sqlStore:      sqlStore,
		settings:      settings,
		features:      features,
	}
}

func (m *SecretsMigrator) ReEncryptSecrets(ctx context.Context) (bool, error) {
	err := m.initProvidersIfNeeded()
	if err != nil {
		return false, err
	}

	toReencrypt := []interface {
		reencrypt(context.Context, *manager.SecretsService, db.DB) bool
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

	for _, r := range toReencrypt {
		if success := r.reencrypt(ctx, m.secretsSrv, m.sqlStore); !success {
			anyFailure = true
		}
	}

	return !anyFailure, nil
}

func (m *SecretsMigrator) RollBackSecrets(ctx context.Context) (bool, error) {
	err := m.initProvidersIfNeeded()
	if err != nil {
		return false, err
	}

	toRollback := []interface {
		rollback(context.Context, *manager.SecretsService, encryption.Internal, db.DB, string) bool
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
		return false, nil
	}

	if sqlErr := m.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec("DELETE FROM data_keys")
		return err
	}); sqlErr != nil {
		logger.Warn("Error while cleaning up data keys table...", "error", sqlErr)
		return false, nil
	}

	return true, nil
}

func (m *SecretsMigrator) initProvidersIfNeeded() error {
	if m.features.IsEnabled(featuremgmt.FlagDisableEnvelopeEncryption) {
		logger.Info("Envelope encryption is not enabled but trying to init providers anyway...")

		if err := m.secretsSrv.InitProviders(); err != nil {
			logger.Error("Envelope encryption providers initialization failed", "error", err)
			return err
		}
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

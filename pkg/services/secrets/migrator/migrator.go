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

type SecretsRotator interface {
	ReEncrypt(context.Context, *manager.SecretsService, db.DB) bool
	Rollback(context.Context, *manager.SecretsService, encryption.Internal, db.DB, string) bool
}

type SecretsMigrator struct {
	encryptionSrv encryption.Internal
	secretsSrv    *manager.SecretsService
	sqlStore      db.DB
	settings      setting.Provider
	features      featuremgmt.FeatureToggles
	rotators      []SecretsRotator
}

func ProvideSecretsMigrator(
	encryptionSrv encryption.Internal,
	service *manager.SecretsService,
	sqlStore db.DB,
	settings setting.Provider,
	features featuremgmt.FeatureToggles,
) *SecretsMigrator {
	rotators := []SecretsRotator{
		simpleSecret{tableName: "dashboard_snapshot", columnName: "dashboard_encrypted"},
		b64Secret{simpleSecret: simpleSecret{tableName: "user_auth", columnName: "o_auth_access_token"}, encoding: base64.StdEncoding},
		b64Secret{simpleSecret: simpleSecret{tableName: "user_auth", columnName: "o_auth_refresh_token"}, encoding: base64.StdEncoding},
		b64Secret{simpleSecret: simpleSecret{tableName: "user_auth", columnName: "o_auth_token_type"}, encoding: base64.StdEncoding},
		b64Secret{simpleSecret: simpleSecret{tableName: "secrets", columnName: "value"}, hasUpdatedColumn: true, encoding: base64.RawStdEncoding},
		jsonSecret{tableName: "data_source"},
		jsonSecret{tableName: "plugin_setting"},
		alertingSecret{},
	}

	return &SecretsMigrator{
		encryptionSrv: encryptionSrv,
		secretsSrv:    service,
		sqlStore:      sqlStore,
		settings:      settings,
		features:      features,
		rotators:      rotators,
	}
}

func (m *SecretsMigrator) RegisterRotators(rotators ...SecretsRotator) {
	m.rotators = append(m.rotators, rotators...)
}

func (m *SecretsMigrator) ReEncryptSecrets(ctx context.Context) (bool, error) {
	err := m.initProvidersIfNeeded()
	if err != nil {
		return false, err
	}

	var anyFailure bool

	for _, r := range m.rotators {
		if success := r.ReEncrypt(ctx, m.secretsSrv, m.sqlStore); !success {
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

	var anyFailure bool

	for _, r := range m.rotators {
		if failed := r.Rollback(ctx,
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

func NewSimpleSecret(tableName, columnName string) simpleSecret {
	return simpleSecret{
		tableName:  tableName,
		columnName: columnName,
	}
}

type b64Secret struct {
	simpleSecret
	hasUpdatedColumn bool
	encoding         *base64.Encoding
}

func NewBase64Secret(simple simpleSecret, encoding *base64.Encoding) b64Secret {
	return b64Secret{
		simpleSecret: simple,
		encoding:     encoding,
	}
}

type jsonSecret struct {
	tableName string
}

type alertingSecret struct{}

func nowInUTC() string {
	return time.Now().UTC().Format("2006-01-02 15:04:05")
}

var logger = log.New("secrets.migrations")

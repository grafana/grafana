package migrator

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/manager"
	legacyEncryption "github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type SecretsRotator interface {
	ReEncrypt(context.Context, *manager.EncryptionManager, db.DB) bool
	Rollback(context.Context, *manager.EncryptionManager, legacyEncryption.Internal, db.DB, string) bool
}

type SecretsMigrator struct {
	encryptionSrv legacyEncryption.Internal
	secretsSrv    *manager.EncryptionManager
	sqlStore      db.DB
	settings      setting.Provider
	features      featuremgmt.FeatureToggles
}

func ProvideSecretsMigrator(
	encryptionSrv legacyEncryption.Internal,
	service *manager.EncryptionManager,
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

	var anyFailure bool

	// TODO
	// for _, r := range m.rotators {
	// 	if success := r.ReEncrypt(ctx, m.secretsSrv, m.sqlStore); !success {
	// 		anyFailure = true
	// 	}
	// }

	return !anyFailure, nil
}

func (m *SecretsMigrator) RollBackSecrets(ctx context.Context) (bool, error) {
	err := m.initProvidersIfNeeded()
	if err != nil {
		return false, err
	}

	var anyFailure bool

	// TODO
	// for _, r := range m.rotators {
	// 	if failed := r.Rollback(ctx,
	// 		m.secretsSrv,
	// 		m.encryptionSrv,
	// 		m.sqlStore,
	// 		m.settings.KeyValue("secrets_manager", "secret_key").Value(),
	// 	); failed {
	// 		anyFailure = true
	// 	}
	// }

	// if anyFailure {
	// 	logger.Warn("Some errors happened, not cleaning up data keys table...")
	// 	return false, nil
	// }

	// if sqlErr := m.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
	// 	_, err := sess.Exec("DELETE FROM data_keys")
	// 	return err
	// }); sqlErr != nil {
	// 	logger.Warn("Error while cleaning up data keys table...", "error", sqlErr)
	// 	return false, nil
	// }

	return !anyFailure, nil
}

func (m *SecretsMigrator) initProvidersIfNeeded() error {
	if m.features.IsEnabledGlobally(featuremgmt.FlagDisableEnvelopeEncryption) {
		logger.Info("Envelope encryption is not enabled but trying to init providers anyway...")

		if err := m.secretsSrv.InitProviders(); err != nil {
			logger.Error("Envelope encryption providers initialization failed", "error", err)
			return err
		}
	}

	return nil
}

// Keeping this here as a reference for when we do this in our new scheme
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

func nowInUTC() string {
	return time.Now().UTC().Format("2006-01-02 15:04:05")
}

var logger = log.New("secrets.migrations")

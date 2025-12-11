package sqlkeeper

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/metrics"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type SQLKeeper struct {
	tracer            trace.Tracer
	encryptionManager contracts.EncryptionManager
	store             contracts.EncryptedValueStorage
	metrics           *metrics.KeeperMetrics
}

var _ contracts.Keeper = (*SQLKeeper)(nil)

func NewSQLKeeper(
	tracer trace.Tracer,
	encryptionManager contracts.EncryptionManager,
	store contracts.EncryptedValueStorage,
	migrationExecutor contracts.EncryptedValueMigrationExecutor,
	reg prometheus.Registerer,
	cfg *setting.Cfg,
) (*SQLKeeper, error) {
	// Only run the migration if running as an MT api server
	if cfg.SecretsManagement.RunDataKeyMigration && cfg.SecretsManagement.RunSecretsDBMigrations {
		// Run the encrypted value store migration before anything else, otherwise operations may fail
		// TODO: This does not need to be here forever, but we may currently have on-prem deployments using GSM, so it needs to be here for now.
		// Periodically assess whether it is safe to remove - most likely for G13 should be fine.
		log := logging.FromContext(context.Background())
		log.Debug("sqlkeeper: executing encrypted value store migration")
		rowsAffected, err := migrationExecutor.Execute(context.Background())
		log.Debug("sqlkeeper: encrypted value store migration completed", "rows_affected", rowsAffected)
		if err != nil {
			return nil, fmt.Errorf("error encountered during encrypted value store migration: %w", err)
		}
	}

	return &SQLKeeper{
		tracer:            tracer,
		encryptionManager: encryptionManager,
		store:             store,
		metrics:           metrics.NewKeeperMetrics(reg),
	}, nil
}

func (s *SQLKeeper) Store(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace xkube.Namespace, name string, version int64, exposedValueOrRef string) (contracts.ExternalID, error) {
	ctx, span := s.tracer.Start(ctx, "SQLKeeper.Store",
		trace.WithAttributes(
			attribute.String("namespace", namespace.String()),
			attribute.String("name", name),
			attribute.Int64("version", version)),
	)
	defer span.End()

	start := time.Now()
	encryptedData, err := s.encryptionManager.Encrypt(ctx, namespace, []byte(exposedValueOrRef))
	if err != nil {
		return "", fmt.Errorf("unable to encrypt value: %w", err)
	}

	_, err = s.store.Create(ctx, namespace, name, version, encryptedData)
	if err != nil {
		return "", fmt.Errorf("unable to store encrypted value: %w", err)
	}

	s.metrics.StoreDuration.WithLabelValues(string(cfg.Type())).Observe(time.Since(start).Seconds())

	// An external id is not required to interact with the sql keeper.
	// An empty string is returned just to comply with the Keeper interface.
	return contracts.ExternalID(""), nil
}

func (s *SQLKeeper) Expose(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace xkube.Namespace, name string, version int64) (secretv1beta1.ExposedSecureValue, error) {
	ctx, span := s.tracer.Start(ctx, "SQLKeeper.Expose", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
		attribute.String("name", name),
		attribute.Int64("version", version),
	))
	defer span.End()

	start := time.Now()
	encryptedValue, err := s.store.Get(ctx, namespace, name, version)
	if err != nil {
		return "", fmt.Errorf("unable to get encrypted value: %w", err)
	}

	exposedBytes, err := s.encryptionManager.Decrypt(ctx, namespace, encryptedValue.EncryptedPayload)
	if err != nil {
		return "", fmt.Errorf("unable to decrypt value: %w", err)
	}

	exposedValue := secretv1beta1.NewExposedSecureValue(string(exposedBytes))
	s.metrics.ExposeDuration.WithLabelValues(string(cfg.Type())).Observe(time.Since(start).Seconds())

	return exposedValue, nil
}

func (s *SQLKeeper) Delete(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace xkube.Namespace, name string, version int64) error {
	ctx, span := s.tracer.Start(ctx, "SQLKeeper.Delete", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
		attribute.String("name", name),
		attribute.Int64("version", version),
	))
	defer span.End()

	start := time.Now()
	err := s.store.Delete(ctx, namespace, name, version)
	if err != nil {
		return fmt.Errorf("failed to delete encrypted value: %w", err)
	}

	s.metrics.DeleteDuration.WithLabelValues(string(cfg.Type())).Observe(time.Since(start).Seconds())

	return nil
}

func (s *SQLKeeper) Update(ctx context.Context, cfg secretv1beta1.KeeperConfig, namespace xkube.Namespace, name string, version int64, exposedValueOrRef string) error {
	ctx, span := s.tracer.Start(ctx, "SQLKeeper.Update", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
		attribute.String("name", name),
		attribute.Int64("version", version),
	))
	defer span.End()

	start := time.Now()
	encryptedData, err := s.encryptionManager.Encrypt(ctx, namespace, []byte(exposedValueOrRef))
	if err != nil {
		return fmt.Errorf("unable to encrypt value: %w", err)
	}

	err = s.store.Update(ctx, namespace, name, version, encryptedData)
	if err != nil {
		return fmt.Errorf("failed to update encrypted value: %w", err)
	}

	s.metrics.UpdateDuration.WithLabelValues(string(cfg.Type())).Observe(time.Since(start).Seconds())

	return nil
}

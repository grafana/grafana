package sqlkeeper

import (
	"context"
	"fmt"
	"time"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/metrics"
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
	reg prometheus.Registerer,
) *SQLKeeper {
	return &SQLKeeper{
		tracer:            tracer,
		encryptionManager: encryptionManager,
		store:             store,
		metrics:           metrics.NewKeeperMetrics(reg),
	}
}

func (s *SQLKeeper) Store(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, exposedValueOrRef string) (contracts.ExternalID, error) {
	ctx, span := s.tracer.Start(ctx, "SQLKeeper.Store", trace.WithAttributes(attribute.String("namespace", namespace)))
	defer span.End()

	start := time.Now()
	encryptedData, err := s.encryptionManager.Encrypt(ctx, namespace, []byte(exposedValueOrRef))
	if err != nil {
		return "", fmt.Errorf("unable to encrypt value: %w", err)
	}

	encryptedVal, err := s.store.Create(ctx, namespace, encryptedData)
	if err != nil {
		return "", fmt.Errorf("unable to store encrypted value: %w", err)
	}

	s.metrics.StoreDuration.WithLabelValues(string(cfg.Type())).Observe(time.Since(start).Seconds())
	externalID := contracts.ExternalID(encryptedVal.UID)
	span.SetAttributes(attribute.String("externalID", externalID.String()))

	return externalID, nil
}

func (s *SQLKeeper) Expose(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID contracts.ExternalID) (secretv0alpha1.ExposedSecureValue, error) {
	ctx, span := s.tracer.Start(ctx, "SQLKeeper.Expose", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("externalID", externalID.String()),
	))
	defer span.End()

	start := time.Now()
	encryptedValue, err := s.store.Get(ctx, namespace, externalID.String())
	if err != nil {
		return "", fmt.Errorf("unable to get encrypted value: %w", err)
	}

	exposedBytes, err := s.encryptionManager.Decrypt(ctx, namespace, encryptedValue.EncryptedData)
	if err != nil {
		return "", fmt.Errorf("unable to decrypt value: %w", err)
	}

	exposedValue := secretv0alpha1.NewExposedSecureValue(string(exposedBytes))
	s.metrics.ExposeDuration.WithLabelValues(string(cfg.Type())).Observe(time.Since(start).Seconds())

	return exposedValue, nil
}

func (s *SQLKeeper) Delete(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID contracts.ExternalID) error {
	ctx, span := s.tracer.Start(ctx, "SQLKeeper.Delete", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("externalID", externalID.String()),
	))
	defer span.End()

	start := time.Now()
	err := s.store.Delete(ctx, namespace, externalID.String())
	if err != nil {
		return fmt.Errorf("failed to delete encrypted value: %w", err)
	}

	s.metrics.DeleteDuration.WithLabelValues(string(cfg.Type())).Observe(time.Since(start).Seconds())

	return nil
}

func (s *SQLKeeper) Update(ctx context.Context, cfg secretv0alpha1.KeeperConfig, namespace string, externalID contracts.ExternalID, exposedValueOrRef string) error {
	ctx, span := s.tracer.Start(ctx, "SQLKeeper.Update", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("externalID", externalID.String()),
	))
	defer span.End()

	start := time.Now()
	encryptedData, err := s.encryptionManager.Encrypt(ctx, namespace, []byte(exposedValueOrRef))
	if err != nil {
		return fmt.Errorf("unable to encrypt value: %w", err)
	}

	err = s.store.Update(ctx, namespace, externalID.String(), encryptedData)
	if err != nil {
		return fmt.Errorf("failed to update encrypted value: %w", err)
	}

	s.metrics.UpdateDuration.WithLabelValues(string(cfg.Type())).Observe(time.Since(start).Seconds())

	return nil
}

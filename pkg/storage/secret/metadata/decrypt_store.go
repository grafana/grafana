package metadata

import (
	"context"
	"fmt"
	"strconv"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-app-sdk/logging"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/storage/secret/metadata/metrics"
)

func ProvideDecryptStorage(
	tracer trace.Tracer,
	keeperService contracts.KeeperService,
	keeperMetadataStorage contracts.KeeperMetadataStorage,
	secureValueMetadataStorage contracts.SecureValueMetadataStorage,
	decryptAuthorizer contracts.DecryptAuthorizer,
	reg prometheus.Registerer,
) (contracts.DecryptStorage, error) {
	if decryptAuthorizer == nil {
		return nil, fmt.Errorf("a decrypt authorizer is required")
	}

	return &decryptStorage{
		tracer:                     tracer,
		keeperMetadataStorage:      keeperMetadataStorage,
		keeperService:              keeperService,
		secureValueMetadataStorage: secureValueMetadataStorage,
		decryptAuthorizer:          decryptAuthorizer,
		metrics:                    metrics.NewStorageMetrics(reg),
	}, nil
}

// decryptStorage is the actual implementation of the decrypt storage.
type decryptStorage struct {
	tracer                     trace.Tracer
	keeperMetadataStorage      contracts.KeeperMetadataStorage
	keeperService              contracts.KeeperService
	secureValueMetadataStorage contracts.SecureValueMetadataStorage
	decryptAuthorizer          contracts.DecryptAuthorizer
	metrics                    *metrics.StorageMetrics
}

// Decrypt decrypts a secure value from the keeper.
func (s *decryptStorage) Decrypt(ctx context.Context, namespace xkube.Namespace, name string) (_ secretv1beta1.ExposedSecureValue, decryptErr error) {
	ctx, span := s.tracer.Start(ctx, "DecryptStorage.Decrypt", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
		attribute.String("name", name),
	))
	defer span.End()

	var decrypterIdentity string
	start := time.Now()
	// TEMPORARY: While we evaluate all of our auditing needs, provide one for decrypt operations.
	defer func() {
		span.SetAttributes(attribute.String("decrypter.identity", decrypterIdentity))

		if decryptErr == nil {
			logging.FromContext(ctx).Info("Audit log:", "operation", "decrypt_secret_success", "namespace", namespace, "secret_name", name, "decrypter_identity", decrypterIdentity)
		} else {
			span.SetStatus(codes.Error, "Decrypt failed")
			span.RecordError(decryptErr)

			logging.FromContext(ctx).Info("Audit log:", "operation", "decrypt_secret_error", "namespace", namespace, "secret_name", name, "decrypter_identity", decrypterIdentity, "error", decryptErr)
		}
		success := decryptErr == nil
		s.metrics.DecryptDuration.WithLabelValues(strconv.FormatBool(success)).Observe(time.Since(start).Seconds())
		s.metrics.DecryptRequestCount.WithLabelValues(strconv.FormatBool(success)).Inc()
	}()

	// Basic authn check before reading a secure value metadata, it is here on purpose.
	if _, ok := claims.AuthInfoFrom(ctx); !ok {
		return "", contracts.ErrDecryptNotAuthorized
	}

	// The auth token will not necessarily have the permission to read the secure value metadata,
	// but we still need to do it to inspect the `decrypters` field, hence the actual `authorize`
	// function call happens after this.
	sv, err := s.secureValueMetadataStorage.Read(ctx, namespace, name, contracts.ReadOpts{})
	if err != nil {
		return "", contracts.ErrDecryptNotFound
	}

	decrypterIdentity, authorized := s.decryptAuthorizer.Authorize(ctx, name, sv.Spec.Decrypters)
	if !authorized {
		return "", contracts.ErrDecryptNotAuthorized
	}

	keeperConfig, err := s.keeperMetadataStorage.GetKeeperConfig(ctx, namespace.String(), sv.Spec.Keeper, contracts.ReadOpts{})
	if err != nil {
		return "", contracts.ErrDecryptFailed
	}

	keeper, err := s.keeperService.KeeperForConfig(keeperConfig)
	if err != nil {
		return "", contracts.ErrDecryptFailed
	}

	exposedValue, err := keeper.Expose(ctx, keeperConfig, namespace.String(), name, sv.Status.Version)
	if err != nil {
		return "", contracts.ErrDecryptFailed
	}

	return exposedValue, nil
}

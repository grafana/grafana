package manager

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"strconv"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption/cipher"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/util"
)

type EncryptionManager struct {
	tracer     trace.Tracer
	store      contracts.DataKeyStorage
	usageStats usagestats.Service

	mtx sync.Mutex

	// The cipher is used to encrypt and decrypt payloads with a data key.
	cipher cipher.Cipher
	// The providerConfig are used to encrypt and decrypt the data keys.
	providerConfig encryption.ProviderConfig

	log log.Logger
}

// ProvideEncryptionManager returns an EncryptionManager that uses the OSS KMS providers, along with any additional third-party (e.g. Enterprise) KMS providers
func ProvideEncryptionManager(
	tracer trace.Tracer,
	store contracts.DataKeyStorage,
	usageStats usagestats.Service,
	enc cipher.Cipher,
	providerConfig encryption.ProviderConfig,
) (contracts.EncryptionManager, error) {
	currentProviderID := providerConfig.CurrentProvider
	if _, ok := providerConfig.AvailableProviders[currentProviderID]; !ok {
		return nil, fmt.Errorf("missing configuration for current encryption provider %s", currentProviderID)
	}

	s := &EncryptionManager{
		tracer:         tracer,
		store:          store,
		usageStats:     usageStats,
		cipher:         enc,
		log:            log.New("encryption"),
		providerConfig: providerConfig,
	}

	s.registerUsageMetrics()

	return s, nil
}

func (s *EncryptionManager) registerUsageMetrics() {
	s.usageStats.RegisterMetricsFunc(func(ctx context.Context) (map[string]any, error) {
		usageMetrics := make(map[string]any)

		// Current provider
		kind, err := s.providerConfig.CurrentProvider.Kind()
		if err != nil {
			return nil, fmt.Errorf("encryptionManager.registerUsageMetrics: %w", err)
		}
		usageMetrics[fmt.Sprintf("stats.%s.encryption.current_provider.%s.count", encryption.UsageInsightsPrefix, kind)] = 1

		// Count by kind
		countByKind := make(map[string]int, len(s.providerConfig.AvailableProviders))
		for id := range s.providerConfig.AvailableProviders {
			kind, err := id.Kind()
			if err != nil {
				return nil, fmt.Errorf("encryptionManager.registerUsageMetrics: %w", err)
			}

			countByKind[kind]++
		}

		for kind, count := range countByKind {
			usageMetrics[fmt.Sprintf("stats.%s.encryption.providers.%s.count", encryption.UsageInsightsPrefix, kind)] = count
		}

		return usageMetrics, nil
	})
}

func (s *EncryptionManager) Encrypt(ctx context.Context, namespace xkube.Namespace, payload []byte) (contracts.EncryptedPayload, error) {
	ctx, span := s.tracer.Start(ctx, "EnvelopeEncryptionManager.Encrypt", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	var err error
	defer func() {
		opsCounter.With(prometheus.Labels{
			"success":   strconv.FormatBool(err == nil),
			"operation": OpEncrypt,
		}).Inc()

		if err != nil {
			span.SetStatus(codes.Error, err.Error())
			span.RecordError(err)
		}
	}()

	label := encryption.KeyLabel(s.providerConfig.CurrentProvider)

	var id string
	var dataKey []byte
	id, dataKey, err = s.currentDataKey(ctx, namespace, label)
	if err != nil {
		s.log.Error("Failed to get current data key", "error", err, "label", label)
		return contracts.EncryptedPayload{}, err
	}

	var encrypted []byte
	encrypted, err = s.cipher.Encrypt(ctx, payload, string(dataKey))
	if err != nil {
		s.log.Error("Failed to encrypt secret", "error", err)
		return contracts.EncryptedPayload{}, err
	}

	encryptedPayload := contracts.EncryptedPayload{
		DataKeyID:     id,
		EncryptedData: encrypted,
	}

	return encryptedPayload, nil
}

// currentDataKey looks up for current data key in cache or database by name, and decrypts it.
// If there's no current data key in cache nor in database it generates a new random data key,
// and stores it into both the in-memory cache and database (encrypted by the encryption provider).
func (s *EncryptionManager) currentDataKey(ctx context.Context, namespace xkube.Namespace, label string) (string, []byte, error) {
	ctx, span := s.tracer.Start(ctx, "EnvelopeEncryptionManager.CurrentDataKey", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
		attribute.String("label", label),
	))
	defer span.End()

	// We want only one request fetching current data key at time to
	// avoid the creation of multiple ones in case there's no one existing.
	s.mtx.Lock()
	defer s.mtx.Unlock()

	// We try to fetch the data key, either from cache or database
	id, dataKey, err := s.dataKeyByLabel(ctx, namespace.String(), label)
	if err != nil {
		return "", nil, err
	}

	// If no existing data key was found, create a new one
	if dataKey == nil {
		id, dataKey, err = s.newDataKey(ctx, namespace.String(), label)
		if err != nil {
			return "", nil, err
		}
	}

	return id, dataKey, nil
}

// dataKeyByLabel looks up for data key in cache by label.
// Otherwise, it fetches it from database, decrypts it and caches it decrypted.
func (s *EncryptionManager) dataKeyByLabel(ctx context.Context, namespace, label string) (string, []byte, error) {
	// 1. Get data key from database.
	dataKey, err := s.store.GetCurrentDataKey(ctx, namespace, label)
	if err != nil {
		if errors.Is(err, contracts.ErrDataKeyNotFound) {
			return "", nil, nil
		}
		return "", nil, err
	}

	// 2.1 Find the encryption provider.
	provider, exists := s.providerConfig.AvailableProviders[dataKey.Provider]
	if !exists {
		return "", nil, fmt.Errorf("could not find encryption provider '%s'", dataKey.Provider)
	}

	// 2.2 Decrypt the data key fetched from the database.
	decrypted, err := provider.Decrypt(ctx, dataKey.EncryptedData)
	if err != nil {
		return "", nil, err
	}

	return dataKey.UID, decrypted, nil
}

// newDataKey creates a new random data key, encrypts it and stores it into the database.
func (s *EncryptionManager) newDataKey(ctx context.Context, namespace string, label string) (string, []byte, error) {
	ctx, span := s.tracer.Start(ctx, "EnvelopeEncryptionManager.NewDataKey", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("label", label),
	))
	defer span.End()

	// 1. Create new data key.
	dataKey, err := newRandomDataKey()
	if err != nil {
		return "", nil, err
	}

	// 2.1 Find the encryption provider.
	provider, exists := s.providerConfig.AvailableProviders[s.providerConfig.CurrentProvider]
	if !exists {
		return "", nil, fmt.Errorf("could not find encryption provider '%s'", s.providerConfig.CurrentProvider)
	}

	// 2.2 Encrypt the data key.
	encrypted, err := provider.Encrypt(ctx, dataKey)
	if err != nil {
		return "", nil, err
	}

	// 3. Store its encrypted value into the DB.
	id := util.GenerateShortUID()

	dbDataKey := contracts.SecretDataKey{
		Active:        true,
		UID:           id,
		Namespace:     namespace,
		Provider:      s.providerConfig.CurrentProvider,
		EncryptedData: encrypted,
		Label:         label,
	}

	err = s.store.CreateDataKey(ctx, &dbDataKey)
	if err != nil {
		return "", nil, err
	}

	return id, dataKey, nil
}

func newRandomDataKey() ([]byte, error) {
	rawDataKey := make([]byte, 16)
	_, err := rand.Read(rawDataKey)
	if err != nil {
		return nil, err
	}
	return rawDataKey, nil
}

func (s *EncryptionManager) Decrypt(ctx context.Context, namespace xkube.Namespace, payload contracts.EncryptedPayload) ([]byte, error) {
	ctx, span := s.tracer.Start(ctx, "EnvelopeEncryptionManager.Decrypt", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	var err error
	defer func() {
		opsCounter.With(prometheus.Labels{
			"success":   strconv.FormatBool(err == nil),
			"operation": OpDecrypt,
		}).Inc()

		if err != nil {
			span.SetStatus(codes.Error, err.Error())
			span.RecordError(err)

			s.log.FromContext(ctx).Error("Failed to decrypt secret", "error", err)
		}
	}()

	if len(payload.EncryptedData) == 0 {
		err = fmt.Errorf("unable to decrypt empty payload")
		return nil, err
	}

	if payload.DataKeyID == "" {
		err = fmt.Errorf("unable to decrypt empty data key id")
		return nil, err
	}

	dataKey, err := s.dataKeyById(ctx, namespace.String(), payload.DataKeyID)
	if err != nil {
		s.log.FromContext(ctx).Error("Failed to lookup data key by id", "id", payload.DataKeyID, "error", err)
		return nil, err
	}

	var decrypted []byte
	decrypted, err = s.cipher.Decrypt(ctx, payload.EncryptedData, string(dataKey))

	return decrypted, err
}

// dataKeyById looks up for data key in the database and returns it decrypted.
func (s *EncryptionManager) dataKeyById(ctx context.Context, namespace, id string) ([]byte, error) {
	ctx, span := s.tracer.Start(ctx, "EnvelopeEncryptionManager.GetDataKey", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("id", id),
	))
	defer span.End()

	// 1. Get encrypted data key from database.
	dataKey, err := s.store.GetDataKey(ctx, namespace, id)
	if err != nil {
		return nil, err
	}

	// 2.1. Find the encryption provider.
	provider, exists := s.providerConfig.AvailableProviders[dataKey.Provider]
	if !exists {
		return nil, fmt.Errorf("could not find encryption provider '%s'", dataKey.Provider)
	}

	// 2.2. Decrypt the data key.
	decrypted, err := provider.Decrypt(ctx, dataKey.EncryptedData)
	if err != nil {
		return nil, err
	}

	return decrypted, nil
}

func (s *EncryptionManager) GetProviders() encryption.ProviderConfig {
	return s.providerConfig
}

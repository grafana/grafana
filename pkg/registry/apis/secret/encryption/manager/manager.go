package manager

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"time"

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
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type EncryptionManager struct {
	tracer     trace.Tracer
	store      contracts.DataKeyStorage
	usageStats usagestats.Service
	cfg        *setting.Cfg

	dataKeyCache       encryption.DataKeyCache
	cacheEncryptionKey string

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
	dataKeyCache encryption.DataKeyCache,
	cfg *setting.Cfg,
) (contracts.EncryptionManager, error) {
	currentProviderID := providerConfig.CurrentProvider
	if _, ok := providerConfig.AvailableProviders[currentProviderID]; !ok {
		return nil, fmt.Errorf("missing configuration for current encryption provider %s", currentProviderID)
	}

	// Use the configured cache encryption key, or generate a random one if not provided.
	cacheEncryptionKey := cfg.SecretsManagement.DataKeysCacheEncryptionKey
	if cacheEncryptionKey == "" {
		randomKey, err := newRandomDataKey()
		if err != nil {
			return nil, fmt.Errorf("failed to generate random cache encryption key: %w", err)
		}
		cacheEncryptionKey = string(randomKey)
	}

	s := &EncryptionManager{
		tracer:             tracer,
		store:              store,
		usageStats:         usageStats,
		cipher:             enc,
		log:                log.New("encryption"),
		providerConfig:     providerConfig,
		dataKeyCache:       dataKeyCache,
		cfg:                cfg,
		cacheEncryptionKey: cacheEncryptionKey,
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

func (s *EncryptionManager) Encrypt(ctx context.Context, namespace xkube.Namespace, payload []byte, opts contracts.EncryptionOption) (contracts.EncryptedPayload, error) {
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
	id, dataKey, err = s.currentDataKey(ctx, namespace, label, opts.SkipCache)
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
func (s *EncryptionManager) currentDataKey(ctx context.Context, namespace xkube.Namespace, label string, skipCache bool) (string, []byte, error) {
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
	id, dataKey, err := s.dataKeyByLabel(ctx, namespace.String(), label, skipCache)
	if err != nil {
		return "", nil, fmt.Errorf("getting current data key by label: %w", err)
	}

	// If no existing data key was found, create a new one
	if dataKey == nil {
		id, dataKey, err = s.newDataKey(ctx, namespace.String(), label, skipCache)
		if err != nil {
			return "", nil, err
		}
	}

	return id, dataKey, nil
}

// dataKeyByLabel looks up for data key in cache by label.
// Otherwise, it fetches it from database, decrypts it and caches it.
func (s *EncryptionManager) dataKeyByLabel(ctx context.Context, namespace, label string, skipCache bool) (string, []byte, error) {
	// 0. Get data key from in-memory cache (stored encrypted).
	if !skipCache {
		entry, exists, cacheErr := s.dataKeyCache.GetByLabel(ctx, namespace, label)
		if cacheErr != nil {
			if errors.Is(cacheErr, encryption.ErrDataKeyCacheUnexpectedNamespace) {
				return "", nil, fmt.Errorf("fatal error getting data key by label from cache: %w", cacheErr)
			}
			s.log.Error("Data key cache get by label", "namespace", namespace, "label", label, "error", cacheErr)
		} else if exists && entry.Active {
			if decrypted, err := s.decryptCachedDataKey(ctx, entry.EncryptedDataKey); err != nil {
				s.log.Error("Failed to decrypt cached data key, fetching from database", "error", err)
			} else {
				return entry.Id, decrypted, nil
			}
		}
	}

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

	// 3. Store the data key into the in-memory cache.
	if !skipCache {
		if err := s.cacheDataKey(ctx, namespace, dataKey, decrypted); err != nil {
			s.log.Error("Failed to cache data key", "namespace", namespace, "error", err)
		}
	}

	return dataKey.UID, decrypted, nil
}

// newDataKey creates a new random data key, encrypts it and stores it into the database.
func (s *EncryptionManager) newDataKey(ctx context.Context, namespace string, label string, skipCache bool) (string, []byte, error) {
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

	// 4. Store the decrypted data key into the in-memory cache.
	if !skipCache {
		if err := s.cacheDataKey(ctx, namespace, &dbDataKey, dataKey); err != nil {
			s.log.Error("Failed to cache data key", "namespace", namespace, "error", err)
		}
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

func (s *EncryptionManager) Decrypt(ctx context.Context, namespace xkube.Namespace, payload contracts.EncryptedPayload, opts contracts.EncryptionOption) ([]byte, error) {
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

	dataKey, err := s.dataKeyById(ctx, namespace.String(), payload.DataKeyID, opts.SkipCache)
	if err != nil {
		s.log.FromContext(ctx).Error("Failed to lookup data key by id", "id", payload.DataKeyID, "error", err)
		return nil, err
	}

	var decrypted []byte
	decrypted, err = s.cipher.Decrypt(ctx, payload.EncryptedData, string(dataKey))

	return decrypted, err
}

// dataKeyById looks up for data key in the database and returns it decrypted.
func (s *EncryptionManager) dataKeyById(ctx context.Context, namespace, id string, skipCache bool) ([]byte, error) {
	ctx, span := s.tracer.Start(ctx, "EnvelopeEncryptionManager.GetDataKey", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("id", id),
	))
	defer span.End()

	// 0. Get data key from in-memory cache (stored encrypted).
	if !skipCache {
		entry, exists, cacheErr := s.dataKeyCache.GetById(ctx, namespace, id)
		if cacheErr != nil {
			if errors.Is(cacheErr, encryption.ErrDataKeyCacheUnexpectedNamespace) {
				return nil, fmt.Errorf("fatal error getting data key by id from cache: %w", cacheErr)
			}
			s.log.Error("Data key cache get by id", "namespace", namespace, "id", id, "error", cacheErr)
		} else if exists && entry.Active {
			if decrypted, err := s.decryptCachedDataKey(ctx, entry.EncryptedDataKey); err != nil {
				s.log.Error("Failed to decrypt cached data key, fetching from database", "error", err)
			} else {
				return decrypted, nil
			}
		}
	}

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

	// 3. Store the data key into the in-memory cache.
	if !skipCache {
		if err := s.cacheDataKey(ctx, namespace, dataKey, decrypted); err != nil {
			s.log.Error("Failed to cache data key", "namespace", namespace, "error", err)
		}
	}

	return decrypted, nil
}

func (s *EncryptionManager) GetProviders() encryption.ProviderConfig {
	return s.providerConfig
}

// ConsolidateNamespace re-encrypts all values for a single namespace using one new DEK held in memory. It avoids unnecessary cache lookups by leveraging the cipher directly.
// For each value, it resolves the old DEK by id, decrypts with it, and re-encrypts using the new in-memory key.
func (s *EncryptionManager) ConsolidateNamespace(ctx context.Context, namespace xkube.Namespace, values []*contracts.EncryptedValue) ([]*contracts.EncryptedPayload, error) {
	ctx, span := s.tracer.Start(ctx, "EnvelopeEncryptionManager.ConsolidateNamespace", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
		attribute.Int("values_count", len(values)),
	))
	defer span.End()

	if len(values) == 0 {
		return nil, nil
	}

	label := encryption.KeyLabel(s.providerConfig.CurrentProvider)
	newKeyID, newKeyDecrypted, err := s.currentDataKey(ctx, namespace, label, false)
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
		span.RecordError(err)
		return nil, fmt.Errorf("ensuring current data key for namespace %s: %w", namespace.String(), err)
	}

	ns := namespace.String()
	results := make([]*contracts.EncryptedPayload, len(values))

	for i, ev := range values {
		oldKey, err := s.dataKeyById(ctx, ns, ev.DataKeyID, false)
		if err != nil {
			if errors.Is(err, encryption.ErrDataKeyCacheUnexpectedNamespace) {
				return nil, fmt.Errorf("fatal namespace mismatch during consolidation: %w", err)
			}
			s.log.FromContext(ctx).Error("Failed to resolve data key during consolidation", "namespace", ev.Namespace, "name", ev.Name, "error", err)
			results[i] = nil
			continue
		}

		plaintext, err := s.cipher.Decrypt(ctx, ev.EncryptedData, string(oldKey))
		if err != nil {
			s.log.FromContext(ctx).Error("Failed to decrypt value during consolidation", "namespace", ev.Namespace, "name", ev.Name, "error", err)
			results[i] = nil
			continue
		}

		encrypted, err := s.cipher.Encrypt(ctx, plaintext, string(newKeyDecrypted))
		if err != nil {
			s.log.FromContext(ctx).Error("Failed to re-encrypt value during consolidation", "namespace", ev.Namespace, "name", ev.Name, "error", err)
			results[i] = nil
			continue
		}

		results[i] = &contracts.EncryptedPayload{DataKeyID: newKeyID, EncryptedData: encrypted}
	}

	s.dataKeyCache.Flush(ctx, namespace.String())
	// TODO: Decide later if the cache should be primed with the new DEK here

	return results, nil
}

func (s *EncryptionManager) Run(ctx context.Context) error {
	gc := time.NewTicker(s.cfg.SecretsManagement.DataKeysCacheCleanupInterval)

	for {
		select {
		case <-gc.C:
			s.log.Debug("Removing expired data keys from cache...")
			s.dataKeyCache.RemoveExpired(ctx)
			s.log.Debug("Removing expired data keys from cache finished successfully")
		case <-ctx.Done():
			s.log.Debug("Grafana is shutting down; stopping...")
			gc.Stop()
			return nil
		}
	}
}

// cacheDataKey caches stores an encrypted data key in the cache.
// Warning: It should not be called from within a database transaction, as we cannot guarantee that a newly created data key has actually been persisted when the key is retrieved.
func (s *EncryptionManager) cacheDataKey(ctx context.Context, namespace string, dataKey *contracts.SecretDataKey, decrypted []byte) error {
	// Encrypt the decrypted data key with configured secret before storing in cache.
	encryptedForCache, err := s.cipher.Encrypt(ctx, decrypted, s.cacheEncryptionKey)
	if err != nil {
		s.log.Error("Failed to encrypt data key for cache, skipping cache", "error", err)
		return nil
	}

	// First, we cache the data key by id, because cache "by id" is
	// only used by decrypt operations, so no risk of corrupting data.
	entry := encryption.DataKeyCacheEntry{
		Namespace:        namespace,
		Id:               dataKey.UID,
		Label:            dataKey.Label,
		EncryptedDataKey: encryptedForCache,
		Active:           dataKey.Active,
	}
	if err := s.dataKeyCache.Set(ctx, namespace, entry); err != nil {
		return fmt.Errorf("set data key in cache: %w", err)
	}
	return nil
}

// decryptCachedDataKey decrypts a data key retrieved from the cache.
func (s *EncryptionManager) decryptCachedDataKey(ctx context.Context, encryptedDataKey []byte) ([]byte, error) {
	return s.cipher.Decrypt(ctx, encryptedDataKey, s.cacheEncryptionKey)
}

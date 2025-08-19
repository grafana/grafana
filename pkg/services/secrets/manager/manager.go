package manager

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/kmsproviders"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const (
	keyIdDelimiter = '#'
)

var (
	// now is used for testing purposes,
	// as a way to fake time.Now function.
	now = time.Now
)

type SecretsService struct {
	tracer     tracing.Tracer
	store      secrets.Store
	enc        encryption.Internal
	cfg        *setting.Cfg
	features   featuremgmt.FeatureToggles
	usageStats usagestats.Service

	mtx          sync.Mutex
	dataKeyCache *dataKeyCache

	pOnce               sync.Once
	providers           map[secrets.ProviderID]secrets.Provider
	kmsProvidersService kmsproviders.Service

	currentProviderID secrets.ProviderID

	log log.Logger
}

func ProvideSecretsService(
	tracer tracing.Tracer,
	store secrets.Store,
	kmsProvidersService kmsproviders.Service,
	enc encryption.Internal,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	usageStats usagestats.Service,
) (*SecretsService, error) {
	ttl := cfg.SectionWithEnvOverrides("security.encryption").Key("data_keys_cache_ttl").MustDuration(15 * time.Minute)

	currentProviderID := kmsproviders.NormalizeProviderID(secrets.ProviderID(
		cfg.SectionWithEnvOverrides("security").Key("encryption_provider").MustString(kmsproviders.Default),
	))

	s := &SecretsService{
		tracer:              tracer,
		store:               store,
		enc:                 enc,
		cfg:                 cfg,
		usageStats:          usageStats,
		kmsProvidersService: kmsProvidersService,
		dataKeyCache:        newDataKeyCache(ttl),
		currentProviderID:   currentProviderID,
		features:            features,
		log:                 log.New("secrets"),
	}

	enabled := !features.IsEnabledGlobally(featuremgmt.FlagDisableEnvelopeEncryption)
	if enabled {
		err := s.InitProviders()
		if err != nil {
			return nil, err
		}
	}

	if _, ok := s.providers[currentProviderID]; enabled && !ok {
		return nil, fmt.Errorf("missing configuration for current encryption provider %s", currentProviderID)
	}

	if !enabled && currentProviderID != kmsproviders.Default {
		s.log.Warn("Changing encryption provider requires enabling envelope encryption feature")
	}

	s.log.Info("Envelope encryption state", "enabled", enabled, "current provider", currentProviderID)

	s.registerUsageMetrics()

	return s, nil
}

func (s *SecretsService) InitProviders() (err error) {
	s.pOnce.Do(func() {
		s.providers, err = s.kmsProvidersService.Provide()
	})

	return
}

func (s *SecretsService) registerUsageMetrics() {
	s.usageStats.RegisterMetricsFunc(func(ctx context.Context) (map[string]any, error) {
		usageMetrics := make(map[string]any)

		// Enabled / disabled
		usageMetrics["stats.encryption.envelope_encryption_enabled.count"] = 0
		if !s.features.IsEnabled(ctx, featuremgmt.FlagDisableEnvelopeEncryption) {
			usageMetrics["stats.encryption.envelope_encryption_enabled.count"] = 1
		}

		// Current provider
		kind, err := s.currentProviderID.Kind()
		if err != nil {
			return nil, err
		}
		usageMetrics[fmt.Sprintf("stats.encryption.current_provider.%s.count", kind)] = 1

		// Count by kind
		countByKind := make(map[string]int)
		for id := range s.providers {
			kind, err := id.Kind()
			if err != nil {
				return nil, err
			}

			countByKind[kind]++
		}

		for kind, count := range countByKind {
			usageMetrics[fmt.Sprintf(`stats.encryption.providers.%s.count`, kind)] = count
		}

		return usageMetrics, nil
	})
}

func (s *SecretsService) providersInitialized() bool {
	return len(s.providers) > 0
}

func (s *SecretsService) encryptedWithEnvelopeEncryption(payload []byte) bool {
	return len(payload) > 0 && payload[0] == keyIdDelimiter
}

var b64 = base64.RawStdEncoding

func (s *SecretsService) Encrypt(ctx context.Context, payload []byte, opt secrets.EncryptionOptions) ([]byte, error) {
	ctx, span := s.tracer.Start(ctx, "secretsService.Encrypt")
	defer span.End()

	c := openfeature.TransactionContext(ctx)
	ofRes, err := openfeature.GetApiInstance().GetClient().BooleanValueDetails(ctx, featuremgmt.FlagDisableEnvelopeEncryption, true, c)
	s.log.Info("OpenFeature testing", "flag", featuremgmt.FlagDisableEnvelopeEncryption, "evaluation details", ofRes, "error", err)

	// Use legacy encryption service if featuremgmt.FlagDisableEnvelopeEncryption toggle is on
	if s.features.IsEnabled(ctx, featuremgmt.FlagDisableEnvelopeEncryption) {
		return s.enc.Encrypt(ctx, payload, s.cfg.SecretKey)
	}

	defer func() {
		opsCounter.With(prometheus.Labels{
			"success":   strconv.FormatBool(err == nil),
			"operation": OpEncrypt,
		}).Inc()
	}()

	// If encryption featuremgmt.FlagEnvelopeEncryption toggle is on, use envelope encryption
	scope := opt()
	label := secrets.KeyLabel(scope, s.currentProviderID)

	var id string
	var dataKey []byte
	id, dataKey, err = s.currentDataKey(ctx, label, scope)
	if err != nil {
		s.log.Error("Failed to get current data key", "error", err, "label", label)
		return nil, err
	}

	var encrypted []byte
	encrypted, err = s.enc.Encrypt(ctx, payload, string(dataKey))
	if err != nil {
		s.log.Error("Failed to encrypt secret", "error", err)
		return nil, err
	}

	prefix := make([]byte, b64.EncodedLen(len(id))+2)
	b64.Encode(prefix[1:], []byte(id))
	prefix[0] = keyIdDelimiter
	prefix[len(prefix)-1] = keyIdDelimiter

	blob := make([]byte, len(prefix)+len(encrypted))
	copy(blob, prefix)
	copy(blob[len(prefix):], encrypted)

	return blob, nil
}

// currentDataKey looks up for current data key in cache or database by name, and decrypts it.
// If there's no current data key in cache nor in database it generates a new random data key,
// and stores it into both the in-memory cache and database (encrypted by the encryption provider).
func (s *SecretsService) currentDataKey(ctx context.Context, label string, scope string) (string, []byte, error) {
	// We want only one request fetching current data key at time to
	// avoid the creation of multiple ones in case there's no one existing.
	s.mtx.Lock()
	defer s.mtx.Unlock()

	// We try to fetch the data key, either from cache or database
	id, dataKey, err := s.dataKeyByLabel(ctx, label)
	if err != nil {
		return "", nil, err
	}

	// If no existing data key was found, create a new one
	if dataKey == nil {
		id, dataKey, err = s.newDataKey(ctx, label, scope)
		if err != nil {
			return "", nil, err
		}
	}

	return id, dataKey, nil
}

// dataKeyByLabel looks up for data key in cache by label.
// Otherwise, it fetches it from database, decrypts it and caches it decrypted.
func (s *SecretsService) dataKeyByLabel(ctx context.Context, label string) (string, []byte, error) {
	// 0. Get data key from in-memory cache.
	if entry, exists := s.dataKeyCache.getByLabel(label); exists && entry.active {
		return entry.id, entry.dataKey, nil
	}

	// 1. Get data key from database.
	dataKey, err := s.store.GetCurrentDataKey(ctx, label)
	if err != nil {
		if errors.Is(err, secrets.ErrDataKeyNotFound) {
			return "", nil, nil
		}
		return "", nil, err
	}

	// 2.1 Find the encryption provider.
	provider, exists := s.providers[kmsproviders.NormalizeProviderID(dataKey.Provider)]
	if !exists {
		return "", nil, fmt.Errorf("could not find encryption provider '%s'", dataKey.Provider)
	}

	// 2.2 Decrypt the data key fetched from the database.
	decrypted, err := provider.Decrypt(ctx, dataKey.EncryptedData)
	if err != nil {
		return "", nil, err
	}

	// 3. Store the decrypted data key into the in-memory cache.
	s.cacheDataKey(dataKey, decrypted)

	return dataKey.Id, decrypted, nil
}

// newDataKey creates a new random data key, encrypts it and stores it into the database and cache.
func (s *SecretsService) newDataKey(ctx context.Context, label string, scope string) (string, []byte, error) {
	// 1. Create new data key.
	dataKey, err := newRandomDataKey()
	if err != nil {
		return "", nil, err
	}

	// 2.1 Find the encryption provider.
	provider, exists := s.providers[s.currentProviderID]
	if !exists {
		return "", nil, fmt.Errorf("could not find encryption provider '%s'", s.currentProviderID)
	}

	// 2.2 Encrypt the data key.
	encrypted, err := provider.Encrypt(ctx, dataKey)
	if err != nil {
		return "", nil, err
	}

	// 3. Store its encrypted value into the DB.
	id := util.GenerateShortUID()

	dbDataKey := secrets.DataKey{
		Active:        true,
		Id:            id,
		Provider:      s.currentProviderID,
		EncryptedData: encrypted,
		Label:         label,
		Scope:         scope,
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

func (s *SecretsService) Decrypt(ctx context.Context, payload []byte) ([]byte, error) {
	ctx, span := s.tracer.Start(ctx, "secretsService.Decrypt")
	defer span.End()

	var err error
	defer func() {
		opsCounter.With(prometheus.Labels{
			"success":   strconv.FormatBool(err == nil),
			"operation": OpDecrypt,
		}).Inc()

		if err != nil {
			s.log.FromContext(ctx).Error("Failed to decrypt secret", "error", err)
		}
	}()

	if len(payload) == 0 {
		err = fmt.Errorf("unable to decrypt empty payload")
		return nil, err
	}

	// If encrypted with envelope encryption, the feature is disabled and
	// no provider is initialized, then we throw an error.
	if s.encryptedWithEnvelopeEncryption(payload) &&
		s.features.IsEnabled(ctx, featuremgmt.FlagDisableEnvelopeEncryption) &&
		!s.providersInitialized() {
		err = fmt.Errorf("failed to decrypt a secret encrypted with envelope encryption: envelope encryption is disabled")
		return nil, err
	}

	var dataKey []byte

	if !s.encryptedWithEnvelopeEncryption(payload) {
		secretKey := s.cfg.SectionWithEnvOverrides("security").Key("secret_key").Value()
		dataKey = []byte(secretKey)
	} else {
		payload = payload[1:]
		endOfKey := bytes.Index(payload, []byte{keyIdDelimiter})
		if endOfKey == -1 {
			err = fmt.Errorf("could not find valid key id in encrypted payload")
			return nil, err
		}
		b64Key := payload[:endOfKey]
		payload = payload[endOfKey+1:]
		keyId := make([]byte, b64.DecodedLen(len(b64Key)))
		_, err = b64.Decode(keyId, b64Key)
		if err != nil {
			return nil, err
		}

		dataKey, err = s.dataKeyById(ctx, string(keyId))
		if err != nil {
			s.log.FromContext(ctx).Error("Failed to lookup data key by id", "id", string(keyId), "error", err)
			return nil, err
		}
	}

	var decrypted []byte
	decrypted, err = s.enc.Decrypt(ctx, payload, string(dataKey))

	return decrypted, err
}

func (s *SecretsService) EncryptJsonData(ctx context.Context, kv map[string]string, opt secrets.EncryptionOptions) (map[string][]byte, error) {
	encrypted := make(map[string][]byte)
	for key, value := range kv {
		encryptedData, err := s.Encrypt(ctx, []byte(value), opt)
		if err != nil {
			return nil, err
		}

		encrypted[key] = encryptedData
	}
	return encrypted, nil
}

func (s *SecretsService) DecryptJsonData(ctx context.Context, sjd map[string][]byte) (map[string]string, error) {
	decrypted := make(map[string]string)
	for key, data := range sjd {
		decryptedData, err := s.Decrypt(ctx, data)
		if err != nil {
			return nil, err
		}

		decrypted[key] = string(decryptedData)
	}
	return decrypted, nil
}

func (s *SecretsService) GetDecryptedValue(ctx context.Context, sjd map[string][]byte, key, fallback string) string {
	if value, ok := sjd[key]; ok {
		decryptedData, err := s.Decrypt(ctx, value)
		if err != nil {
			return fallback
		}

		return string(decryptedData)
	}

	return fallback
}

// dataKeyById looks up for data key in cache.
// Otherwise, it fetches it from database and returns it decrypted.
func (s *SecretsService) dataKeyById(ctx context.Context, id string) ([]byte, error) {
	// 0. Get decrypted data key from in-memory cache.
	if entry, exists := s.dataKeyCache.getById(id); exists {
		return entry.dataKey, nil
	}

	// 1. Get encrypted data key from database.
	dataKey, err := s.store.GetDataKey(ctx, id)
	if err != nil {
		return nil, err
	}

	// 2.1. Find the encryption provider.
	provider, exists := s.providers[kmsproviders.NormalizeProviderID(dataKey.Provider)]
	if !exists {
		return nil, fmt.Errorf("could not find encryption provider '%s'", dataKey.Provider)
	}

	// 2.2. Decrypt the data key.
	decrypted, err := provider.Decrypt(ctx, dataKey.EncryptedData)
	if err != nil {
		return nil, err
	}

	// 3. Store the decrypted data key into the in-memory cache.
	s.cacheDataKey(dataKey, decrypted)

	return decrypted, nil
}

func (s *SecretsService) GetProviders() map[secrets.ProviderID]secrets.Provider {
	return s.providers
}

func (s *SecretsService) RotateDataKeys(ctx context.Context) error {
	s.log.Info("Data keys rotation triggered, acquiring lock...")

	s.mtx.Lock()
	defer s.mtx.Unlock()

	s.log.Info("Data keys rotation started")
	err := s.store.DisableDataKeys(ctx)
	if err != nil {
		s.log.Error("Data keys rotation failed", "error", err)
		return err
	}

	s.dataKeyCache.flush()
	s.log.Info("Data keys rotation finished successfully")

	return nil
}

func (s *SecretsService) ReEncryptDataKeys(ctx context.Context) error {
	s.log.Info("Data keys re-encryption triggered")

	if s.features.IsEnabled(ctx, featuremgmt.FlagDisableEnvelopeEncryption) {
		s.log.Info("Envelope encryption is not enabled but trying to init providers anyway...")

		if err := s.InitProviders(); err != nil {
			s.log.Error("Envelope encryption providers initialization failed", "error", err)
			return err
		}
	}

	if err := s.store.ReEncryptDataKeys(ctx, s.providers, s.currentProviderID); err != nil {
		s.log.Error("Data keys re-encryption failed", "error", err)
		return err
	}

	s.dataKeyCache.flush()
	s.log.Info("Data keys re-encryption finished successfully")

	return nil
}

func (s *SecretsService) Run(ctx context.Context) error {
	gc := time.NewTicker(
		s.cfg.SectionWithEnvOverrides("security.encryption").Key("data_keys_cache_cleanup_interval").
			MustDuration(time.Minute),
	)

	grp, gCtx := errgroup.WithContext(ctx)

	for _, p := range s.providers {
		if svc, ok := p.(secrets.BackgroundProvider); ok {
			grp.Go(func() error {
				return svc.Run(gCtx)
			})
		}
	}

	for {
		select {
		case <-gc.C:
			s.log.Debug("Removing expired data keys from cache...")
			s.dataKeyCache.removeExpired()
			s.log.Debug("Removing expired data keys from cache finished successfully")
		case <-gCtx.Done():
			s.log.Debug("Grafana is shutting down; stopping...")
			gc.Stop()

			if err := grp.Wait(); err != nil && !errors.Is(err, context.Canceled) {
				return err
			}

			return nil
		}
	}
}

// Caching a data key is tricky, because at SecretsService level we cannot guarantee
// that a newly created data key has actually been persisted, depending on the different
// use cases that rely on SecretsService encryption and different database engines that
// we have support for, because the data key creation may have happened within a DB TX,
// that may fail afterwards.
//
// Therefore, if we cache a data key that hasn't been persisted with success (and won't),
// and later that one is used for a encryption operation (aside from the DB TX that created
// it), we may end up with data encrypted by a non-persisted data key, which could end up
// in (unrecoverable) data corruption.
//
// So, we cache the data key by id and/or by label, depending on the data key's lifetime,
// assuming that a data key older than a "caution period" should have been persisted.
//
// Look at the comments inline for further details.
// You can also take a look at the issue below for more context:
// https://github.com/grafana/grafana-enterprise/issues/4252
func (s *SecretsService) cacheDataKey(dataKey *secrets.DataKey, decrypted []byte) {
	// First, we cache the data key by id, because cache "by id" is
	// only used by decrypt operations, so no risk of corrupting data.
	entry := &dataKeyCacheEntry{
		id:      dataKey.Id,
		label:   dataKey.Label,
		dataKey: decrypted,
		active:  dataKey.Active,
	}

	s.dataKeyCache.addById(entry)

	// Then, we cache the data key by label, ONLY if data key's lifetime
	// is longer than a certain "caution period", because cache "by label"
	// is used (only) by encrypt operations, and we want to ensure that
	// no data key is cached for encryption ops before being persisted.

	const cautionPeriod = 10 * time.Minute
	// We consider a "caution period" of 10m to be long enough for any database
	// transaction that implied a data key creation to have finished successfully.
	//
	// Therefore, we consider that if we fetch a data key from the database,
	// more than 10m later than its creation, it should have been actually
	// persisted - i.e. the transaction that created it is no longer running.

	nowMinusCautionPeriod := now().Add(-cautionPeriod)
	if dataKey.Created.Before(nowMinusCautionPeriod) {
		s.dataKeyCache.addByLabel(entry)
	}
}

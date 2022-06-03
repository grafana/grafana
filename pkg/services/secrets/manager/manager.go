package manager

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/kmsproviders"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"golang.org/x/sync/errgroup"
	"xorm.io/xorm"
)

type SecretsService struct {
	store      secrets.Store
	enc        encryption.Internal
	settings   setting.Provider
	features   featuremgmt.FeatureToggles
	usageStats usagestats.Service

	currentProviderID secrets.ProviderID
	providers         map[secrets.ProviderID]secrets.Provider
	dataKeyCache      *dataKeyCache
	log               log.Logger
}

func ProvideSecretsService(
	store secrets.Store,
	kmsProvidersService kmsproviders.Service,
	enc encryption.Internal,
	settings setting.Provider,
	features featuremgmt.FeatureToggles,
	usageStats usagestats.Service,
) (*SecretsService, error) {
	providers, err := kmsProvidersService.Provide()
	if err != nil {
		return nil, err
	}

	logger := log.New("secrets")
	enabled := features.IsEnabled(featuremgmt.FlagEnvelopeEncryption)
	currentProviderID := kmsproviders.NormalizeProviderID(secrets.ProviderID(
		settings.KeyValue("security", "encryption_provider").MustString(kmsproviders.Default),
	))

	if _, ok := providers[currentProviderID]; enabled && !ok {
		return nil, fmt.Errorf("missing configuration for current encryption provider %s", currentProviderID)
	}

	if !enabled && currentProviderID != kmsproviders.Default {
		logger.Warn("Changing encryption provider requires enabling envelope encryption feature")
	}

	logger.Debug("Envelope encryption state", "enabled", enabled, "current provider", currentProviderID)

	ttl := settings.KeyValue("security.encryption", "data_keys_cache_ttl").MustDuration(15 * time.Minute)
	cache := newDataKeyCache(ttl)

	s := &SecretsService{
		store:             store,
		enc:               enc,
		settings:          settings,
		usageStats:        usageStats,
		providers:         providers,
		currentProviderID: currentProviderID,
		dataKeyCache:      cache,
		features:          features,
		log:               logger,
	}

	s.registerUsageMetrics()

	return s, nil
}

func (s *SecretsService) registerUsageMetrics() {
	s.usageStats.RegisterMetricsFunc(func(context.Context) (map[string]interface{}, error) {
		usageMetrics := make(map[string]interface{})

		// Enabled / disabled
		usageMetrics["stats.encryption.envelope_encryption_enabled.count"] = 0
		if s.features.IsEnabled(featuremgmt.FlagEnvelopeEncryption) {
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

var b64 = base64.RawStdEncoding

func (s *SecretsService) Encrypt(ctx context.Context, payload []byte, opt secrets.EncryptionOptions) ([]byte, error) {
	return s.EncryptWithDBSession(ctx, payload, opt, nil)
}

func (s *SecretsService) EncryptWithDBSession(ctx context.Context, payload []byte, opt secrets.EncryptionOptions, sess *xorm.Session) ([]byte, error) {
	// Use legacy encryption service if envelopeEncryptionFeatureToggle toggle is off
	if !s.features.IsEnabled(featuremgmt.FlagEnvelopeEncryption) {
		return s.enc.Encrypt(ctx, payload, setting.SecretKey)
	}

	var err error
	defer func() {
		opsCounter.With(prometheus.Labels{
			"success":   strconv.FormatBool(err == nil),
			"operation": OpEncrypt,
		}).Inc()
	}()

	// If encryption featuremgmt.FlagEnvelopeEncryption toggle is on, use envelope encryption
	scope := opt()
	keyName := s.keyName(scope)

	var dataKey []byte
	dataKey, err = s.dataKey(ctx, keyName)
	if err != nil {
		if errors.Is(err, secrets.ErrDataKeyNotFound) {
			dataKey, err = s.newDataKey(ctx, keyName, scope, sess)
			if err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}

	var encrypted []byte
	encrypted, err = s.enc.Encrypt(ctx, payload, string(dataKey))
	if err != nil {
		return nil, err
	}

	prefix := make([]byte, b64.EncodedLen(len(keyName))+2)
	b64.Encode(prefix[1:], []byte(keyName))
	prefix[0] = '#'
	prefix[len(prefix)-1] = '#'

	blob := make([]byte, len(prefix)+len(encrypted))
	copy(blob, prefix)
	copy(blob[len(prefix):], encrypted)

	return blob, nil
}

func (s *SecretsService) keyName(scope string) string {
	return fmt.Sprintf("%s/%s@%s", now().Format("2006-01-02"), scope, s.currentProviderID)
}

func (s *SecretsService) Decrypt(ctx context.Context, payload []byte) ([]byte, error) {
	if len(payload) == 0 {
		return nil, fmt.Errorf("unable to decrypt empty payload")
	}

	// Use legacy encryption service if featuremgmt.FlagDisableEnvelopeEncryption toggle is on
	if !s.features.IsEnabled(featuremgmt.FlagEnvelopeEncryption) {
		if len(payload) > 0 && payload[0] == '#' {
			return nil, fmt.Errorf("failed to decrypt a secret encrypted with envelope encryption: envelope encryption is disabled")
		}
		return s.enc.Decrypt(ctx, payload, setting.SecretKey)
	}

	// If encryption featuremgmt.FlagEnvelopeEncryption toggle is on, use envelope encryption
	var err error
	defer func() {
		opsCounter.With(prometheus.Labels{
			"success":   strconv.FormatBool(err == nil),
			"operation": OpDecrypt,
		}).Inc()
	}()

	var dataKey []byte

	if payload[0] != '#' {
		secretKey := s.settings.KeyValue("security", "secret_key").Value()
		dataKey = []byte(secretKey)
	} else {
		payload = payload[1:]
		endOfKey := bytes.Index(payload, []byte{'#'})
		if endOfKey == -1 {
			err = fmt.Errorf("could not find valid key in encrypted payload")
			return nil, err
		}
		b64Key := payload[:endOfKey]
		payload = payload[endOfKey+1:]
		key := make([]byte, b64.DecodedLen(len(b64Key)))
		_, err = b64.Decode(key, b64Key)
		if err != nil {
			return nil, err
		}

		dataKey, err = s.dataKey(ctx, string(key))
		if err != nil {
			s.log.Error("Failed to lookup data key", "name", string(key), "error", err)
			return nil, err
		}
	}

	var decrypted []byte
	decrypted, err = s.enc.Decrypt(ctx, payload, string(dataKey))

	return decrypted, err
}

func (s *SecretsService) EncryptJsonData(ctx context.Context, kv map[string]string, opt secrets.EncryptionOptions) (map[string][]byte, error) {
	return s.EncryptJsonDataWithDBSession(ctx, kv, opt, nil)
}

func (s *SecretsService) EncryptJsonDataWithDBSession(ctx context.Context, kv map[string]string, opt secrets.EncryptionOptions, sess *xorm.Session) (map[string][]byte, error) {
	encrypted := make(map[string][]byte)
	for key, value := range kv {
		encryptedData, err := s.EncryptWithDBSession(ctx, []byte(value), opt, sess)
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

func newRandomDataKey() ([]byte, error) {
	rawDataKey := make([]byte, 16)
	_, err := rand.Read(rawDataKey)
	if err != nil {
		return nil, err
	}
	return rawDataKey, nil
}

// newDataKey creates a new random DEK, caches it and returns its value
func (s *SecretsService) newDataKey(ctx context.Context, name string, scope string, sess *xorm.Session) ([]byte, error) {
	// 1. Create new DEK
	dataKey, err := newRandomDataKey()
	if err != nil {
		return nil, err
	}
	provider, exists := s.providers[s.currentProviderID]
	if !exists {
		return nil, fmt.Errorf("could not find encryption provider '%s'", s.currentProviderID)
	}

	// 2. Encrypt it
	encrypted, err := provider.Encrypt(ctx, dataKey)
	if err != nil {
		return nil, err
	}

	// 3. Store its encrypted value in db
	dek := secrets.DataKey{
		Active:        true, // TODO: right now we never mark a key as deactivated
		Name:          name,
		Provider:      s.currentProviderID,
		EncryptedData: encrypted,
		Scope:         scope,
	}

	if sess == nil {
		err = s.store.CreateDataKey(ctx, dek)
	} else {
		err = s.store.CreateDataKeyWithDBSession(ctx, dek, sess)
	}

	if err != nil {
		return nil, err
	}

	// 4. Cache its unencrypted value and return it
	s.dataKeyCache.add(name, dataKey)

	return dataKey, nil
}

// dataKey looks up DEK in cache or database, and decrypts it
func (s *SecretsService) dataKey(ctx context.Context, name string) ([]byte, error) {
	if dataKey, exists := s.dataKeyCache.get(name); exists {
		return dataKey, nil
	}

	// 1. get encrypted data key from database
	dataKey, err := s.store.GetDataKey(ctx, name)
	if err != nil {
		return nil, err
	}

	// 2. decrypt data key
	provider, exists := s.providers[kmsproviders.NormalizeProviderID(dataKey.Provider)]
	if !exists {
		return nil, fmt.Errorf("could not find encryption provider '%s'", dataKey.Provider)
	}

	decrypted, err := provider.Decrypt(ctx, dataKey.EncryptedData)
	if err != nil {
		return nil, err
	}

	// 3. cache data key
	s.dataKeyCache.add(name, decrypted)

	return decrypted, nil
}

func (s *SecretsService) GetProviders() map[secrets.ProviderID]secrets.Provider {
	return s.providers
}

func (s *SecretsService) ReEncryptDataKeys(ctx context.Context) error {
	err := s.store.ReEncryptDataKeys(ctx, s.providers, s.currentProviderID)
	if err != nil {
		return err
	}

	s.dataKeyCache.flush()

	return nil
}

func (s *SecretsService) Run(ctx context.Context) error {
	gc := time.NewTicker(
		s.settings.KeyValue("security.encryption", "data_keys_cache_cleanup_interval").
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
			s.log.Debug("removing expired data encryption keys from cache...")
			s.dataKeyCache.removeExpired()
			s.log.Debug("done removing expired data encryption keys from cache")
		case <-gCtx.Done():
			s.log.Debug("grafana is shutting down; stopping...")
			gc.Stop()

			if err := grp.Wait(); err != nil && !errors.Is(err, context.Canceled) {
				return err
			}

			return nil
		}
	}
}

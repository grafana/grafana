package manager

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/secrets"
	grafana "github.com/grafana/grafana/pkg/services/secrets/defaultprovider"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	defaultProvider                 = "secretKey"
	envelopeEncryptionFeatureToggle = "envelopeEncryption"
)

type SecretsService struct {
	store    secrets.Store
	bus      bus.Bus
	enc      encryption.Internal
	settings setting.Provider

	currentProvider string
	providers       map[string]secrets.Provider
	dataKeyCache    map[string]dataKeyCacheItem
}

func ProvideSecretsService(store secrets.Store, bus bus.Bus, enc encryption.Internal, settings setting.Provider) *SecretsService {
	providers := map[string]secrets.Provider{
		defaultProvider: grafana.New(settings, enc),
	}
	currentProvider := settings.KeyValue("security", "encryption_provider").MustString(defaultProvider)

	s := &SecretsService{
		store:           store,
		bus:             bus,
		enc:             enc,
		settings:        settings,
		providers:       providers,
		currentProvider: currentProvider,
		dataKeyCache:    make(map[string]dataKeyCacheItem),
	}

	return s
}

type dataKeyCacheItem struct {
	expiry  time.Time
	dataKey []byte
}

var b64 = base64.RawStdEncoding

func (s *SecretsService) Encrypt(ctx context.Context, payload []byte, opt secrets.EncryptionOptions) ([]byte, error) {
	// Use legacy encryption service if envelopeEncryptionFeatureToggle toggle is off
	if !s.settings.IsFeatureToggleEnabled(envelopeEncryptionFeatureToggle) {
		return s.enc.Encrypt(ctx, payload, setting.SecretKey)
	}

	// If encryption envelopeEncryptionFeatureToggle toggle is on, use envelope encryption
	scope := opt()
	keyName := fmt.Sprintf("%s/%s@%s", time.Now().Format("2006-01-02"), scope, s.currentProvider)

	dataKey, err := s.dataKey(ctx, keyName)
	if err != nil {
		if errors.Is(err, secrets.ErrDataKeyNotFound) {
			dataKey, err = s.newDataKey(ctx, keyName, scope)
			if err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}

	encrypted, err := s.enc.Encrypt(ctx, payload, string(dataKey))
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

func (s *SecretsService) Decrypt(ctx context.Context, payload []byte) ([]byte, error) {
	// Use legacy encryption service if envelopeEncryptionFeatureToggle toggle is off
	if !s.settings.IsFeatureToggleEnabled(envelopeEncryptionFeatureToggle) {
		return s.enc.Decrypt(ctx, payload, setting.SecretKey)
	}

	// If encryption envelopeEncryptionFeatureToggle toggle is on, use envelope encryption
	if len(payload) == 0 {
		return nil, fmt.Errorf("unable to decrypt empty payload")
	}

	var dataKey []byte

	if payload[0] != '#' {
		secretKey := s.settings.KeyValue("security", "secret_key").Value()
		dataKey = []byte(secretKey)
	} else {
		payload = payload[1:]
		endOfKey := bytes.Index(payload, []byte{'#'})
		if endOfKey == -1 {
			return nil, fmt.Errorf("could not find valid key in encrypted payload")
		}
		b64Key := payload[:endOfKey]
		payload = payload[endOfKey+1:]
		key := make([]byte, b64.DecodedLen(len(b64Key)))
		_, err := b64.Decode(key, b64Key)
		if err != nil {
			return nil, err
		}

		dataKey, err = s.dataKey(ctx, string(key))
		if err != nil {
			return nil, err
		}
	}

	return s.enc.Decrypt(ctx, payload, string(dataKey))
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

func newRandomDataKey() ([]byte, error) {
	rawDataKey := make([]byte, 16)
	_, err := rand.Read(rawDataKey)
	if err != nil {
		return nil, err
	}
	return rawDataKey, nil
}

// newDataKey creates a new random DEK, caches it and returns its value
func (s *SecretsService) newDataKey(ctx context.Context, name string, scope string) ([]byte, error) {
	// 1. Create new DEK
	dataKey, err := newRandomDataKey()
	if err != nil {
		return nil, err
	}
	provider, exists := s.providers[s.currentProvider]
	if !exists {
		return nil, fmt.Errorf("could not find encryption provider '%s'", s.currentProvider)
	}

	// 2. Encrypt it
	encrypted, err := provider.Encrypt(ctx, dataKey)
	if err != nil {
		return nil, err
	}

	// 3. Store its encrypted value in db
	err = s.store.CreateDataKey(ctx, secrets.DataKey{
		Active:        true, // TODO: right now we never mark a key as deactivated
		Name:          name,
		Provider:      s.currentProvider,
		EncryptedData: encrypted,
		Scope:         scope,
	})
	if err != nil {
		return nil, err
	}

	// 4. Cache its unencrypted value and return it
	s.dataKeyCache[name] = dataKeyCacheItem{
		expiry:  time.Now().Add(15 * time.Minute),
		dataKey: dataKey,
	}

	return dataKey, nil
}

// dataKey looks up DEK in cache or database, and decrypts it
func (s *SecretsService) dataKey(ctx context.Context, name string) ([]byte, error) {
	if item, exists := s.dataKeyCache[name]; exists {
		if item.expiry.Before(time.Now()) && !item.expiry.IsZero() {
			delete(s.dataKeyCache, name)
		} else {
			return item.dataKey, nil
		}
	}

	// 1. get encrypted data key from database
	dataKey, err := s.store.GetDataKey(ctx, name)
	if err != nil {
		return nil, err
	}

	// 2. decrypt data key
	provider, exists := s.providers[dataKey.Provider]
	if !exists {
		return nil, fmt.Errorf("could not find encryption provider '%s'", dataKey.Provider)
	}

	decrypted, err := provider.Decrypt(ctx, dataKey.EncryptedData)
	if err != nil {
		return nil, err
	}

	// 3. cache data key
	s.dataKeyCache[name] = dataKeyCacheItem{
		expiry:  time.Now().Add(15 * time.Minute),
		dataKey: decrypted,
	}

	return decrypted, nil
}

func (s *SecretsService) RegisterProvider(providerID string, provider secrets.Provider) {
	s.providers[providerID] = provider
}

func (s *SecretsService) CurrentProviderID() string {
	return s.currentProvider
}

func (s *SecretsService) GetProviders() map[string]secrets.Provider {
	return s.providers
}

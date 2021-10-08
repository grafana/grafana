package secrets

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/services/encryption"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/services/secrets/types"
	"github.com/grafana/grafana/pkg/setting"
)

const defaultProvider = "secretKey"

type SecretsService struct {
	sqlStore *sqlstore.SQLStore
	bus      bus.Bus
	enc      encryption.Service
	settings setting.Provider

	defaultProvider string
	providers       map[string]Provider
	dataKeyCache    map[string]dataKeyCacheItem
}

func ProvideSecretsService(sqlStore *sqlstore.SQLStore, bus bus.Bus, enc encryption.Service, settings setting.Provider) SecretsService {
	providers := map[string]Provider{
		defaultProvider: newGrafanaProvider(settings, enc),
	}

	s := SecretsService{
		sqlStore:        sqlStore,
		bus:             bus,
		enc:             enc,
		settings:        settings,
		defaultProvider: defaultProvider,
		providers:       providers,
		dataKeyCache:    make(map[string]dataKeyCacheItem),
	}

	return s
}

type dataKeyCacheItem struct {
	expiry  time.Time
	dataKey []byte
}

type Provider interface {
	Encrypt(ctx context.Context, blob []byte) ([]byte, error)
	Decrypt(ctx context.Context, blob []byte) ([]byte, error)
}

var b64 = base64.RawStdEncoding

type EncryptionOptions func() string

// WithoutScope uses a root level data key for encryption (DEK),
// in other words this DEK is not bound to any specific scope (not attached to any user, org, etc.).
func WithoutScope() EncryptionOptions {
	return func() string {
		return "root"
	}
}

// WithScope uses a data key for encryption bound to some specific scope (i.e., user, org, etc.).
// Scope should look like "user:10", "org:1".
func WithScope(scope string) EncryptionOptions {
	return func() string {
		return scope
	}
}

func (s *SecretsService) Encrypt(ctx context.Context, payload []byte, opt EncryptionOptions) ([]byte, error) {
	scope := opt()
	keyName := fmt.Sprintf("%s/%s@%s", time.Now().Format("2006-01-02"), scope, s.defaultProvider)

	dataKey, err := s.dataKey(ctx, keyName)
	if err != nil {
		if errors.Is(err, types.ErrDataKeyNotFound) {
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

func (s *SecretsService) EncryptJsonData(ctx context.Context, kv map[string]string, opt EncryptionOptions) (map[string][]byte, error) {
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
	provider, exists := s.providers[s.defaultProvider]
	if !exists {
		return nil, fmt.Errorf("could not find encryption provider '%s'", s.defaultProvider)
	}

	// 2. Encrypt it
	encrypted, err := provider.Encrypt(ctx, dataKey)
	if err != nil {
		return nil, err
	}

	// 3. Store its encrypted value in db
	err = s.CreateDataKey(ctx, types.DataKey{
		Active:        true, // TODO: right now we never mark a key as deactivated
		Name:          name,
		Provider:      s.defaultProvider,
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
	dataKey, err := s.GetDataKey(ctx, name)
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

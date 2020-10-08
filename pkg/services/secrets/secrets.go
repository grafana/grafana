package secrets

import (
	"encoding/base64"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

var logger = log.New("secrets")

type Secrets struct {
	store *sqlstore.SqlStore `inject:""`

	providers    map[string]Provider
	dataKeyCache map[string]dataKeyCacheItem
}

type dataKeyCacheItem struct {
	expiry  time.Time
	dataKey []byte
}

type Provider interface {
	Encrypt(blob []byte) ([]byte, error)
	Decrypt(blob []byte) ([]byte, error)
}

func (s *Secrets) Init() error {
	s.providers = map[string]Provider{
		"": &secretKey{
			key: func() []byte {
				return []byte(setting.SecretKey)
			},
		},
	}

	return nil
}

func (s *Secrets) Encrypt(payload []byte, key string) ([]byte, error) {
	dataKey, err := s.dataKey(key)
	if err != nil {
		return nil, err
	}

	b64 := base64.StdEncoding
	prefix := make([]byte, b64.EncodedLen(len(key))+2)
	b64.Encode(prefix[1:], []byte(key))
	prefix[0] = '#'
	prefix[len(prefix)-1] = '#'

	blob := make([]byte, len(prefix)+len(payload))
	copy(blob, prefix)
	copy(blob[len(prefix):], payload)

	return encrypt(blob, dataKey)
}

func (s *Secrets) Decrypt(payload []byte, key string) ([]byte, error) {
	dataKey, err := s.dataKey(key)
	if err != nil {
		return nil, err
	}

	return decrypt(payload, dataKey)
}

func (s *Secrets) dataKey(key string) ([]byte, error) {
	if key == "" {
		return []byte(setting.SecretKey), nil
	}

	if item, exists := s.dataKeyCache[key]; exists {
		if item.expiry.Before(time.Now()) && !item.expiry.IsZero() {
			delete(s.dataKeyCache, key)
		} else {
			return item.dataKey, nil
		}
	}

	// 1. get encrypted data key from database
	dataKey, err := s.store.GetDataKey(key)
	if err != nil {
		return nil, err
	}

	// 2. decrypt data key
	provider, exists := s.providers[dataKey.Provider]
	if !exists {
		return nil, fmt.Errorf("could not find encryption provider '%s'", dataKey.Provider)
	}

	decrypted, err := provider.Decrypt(dataKey.EncryptedData)
	if err != nil {
		return nil, err
	}

	// 3. cache data key
	s.dataKeyCache[key] = dataKeyCacheItem{
		expiry:  time.Now().Add(15 * time.Minute),
		dataKey: decrypted,
	}

	return decrypted, nil
}

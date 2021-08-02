package secrets

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/registry"

	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana/pkg/bus"

	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

var logger = log.New("secrets") // TODO: should it be at the package level?

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "SecretsService",
		Instance:     &SecretsService{},
		InitPriority: registry.High,
	})
}

type SecretsService struct {
	Store *sqlstore.SQLStore `inject:""`
	Bus   bus.Bus            `inject:""`

	defaultProvider string
	providers       map[string]Provider
	dataKeyCache    map[string]dataKeyCacheItem
}

type dataKeyCacheItem struct {
	expiry  time.Time
	dataKey []byte
}

type Provider interface {
	Encrypt(blob []byte) ([]byte, error)
	Decrypt(blob []byte) ([]byte, error)
}

func (s *SecretsService) Init() error {
	s.providers = map[string]Provider{
		"settings-secret": &settingsSecretKey{
			key: func() []byte {
				return []byte(setting.SecretKey)
			},
		},
	}
	s.defaultProvider = "settings-secret"
	logger.Debug("configured secrets provider", s.defaultProvider)

	s.dataKeyCache = make(map[string]dataKeyCacheItem, 0)

	util.Encrypt = s.Encrypt
	util.Decrypt = s.Decrypt

	return nil
}

// newDataKey creates a new random DEK, caches it and returns its value
func (s *SecretsService) newDataKey(ctx context.Context, name string) ([]byte, error) {
	// 1. Create new DEK
	dataKey, err := newRandomDataKey()
	provider, exists := s.providers[s.defaultProvider]
	if !exists {
		return nil, fmt.Errorf("could not find encryption provider '%s'", s.defaultProvider)
	}

	// 2. Encrypt it
	encrypted, err := provider.Encrypt(dataKey)
	if err != nil {
		return nil, err
	}

	// 3. Store its encrypted value in db
	err = s.Store.CreateDataKey(ctx, models.DataKey{
		Active:        true, // TODO: how do we manage active/deactivated DEKs?
		Name:          name,
		Provider:      s.defaultProvider,
		EncryptedData: encrypted,
		// TODO: Add migration to include EntityID: varchar column
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

func newRandomDataKey() ([]byte, error) {
	rawDataKey := make([]byte, 16)
	_, err := rand.Read(rawDataKey)
	if err != nil {
		return nil, err
	}
	return rawDataKey, nil
}

var b64 = base64.RawStdEncoding

func (s *SecretsService) Encrypt(payload []byte, entityID string) ([]byte, error) {
	keyName := fmt.Sprintf("%s-%s-%s", s.defaultProvider, time.Now().Format("2006-01-02"), entityID)

	dataKey, err := s.dataKey(keyName)
	if err != nil {
		if errors.Is(err, models.ErrDataKeyNotFound) { // TODO: should it be in models?
			dataKey, err = s.newDataKey(context.TODO(), keyName)
			if err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}

	encrypted, err := encrypt(payload, dataKey)
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

func (s *SecretsService) Decrypt(payload []byte) ([]byte, error) {
	if len(payload) == 0 {
		return []byte{}, nil // TODO: !!! Not sure if it should return error like util.decrypt did (also see tests)
	}

	var dataKey []byte

	if payload[0] != '#' {
		dataKey = []byte(setting.SecretKey)
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

		dataKey, err = s.dataKey(string(key))
		if err != nil {
			return nil, err
		}
	}

	return decrypt(payload, dataKey)
}

// dataKey looks up DEK in cache or database, and decrypts it
func (s *SecretsService) dataKey(name string) ([]byte, error) {
	if item, exists := s.dataKeyCache[name]; exists {
		if item.expiry.Before(time.Now()) && !item.expiry.IsZero() {
			delete(s.dataKeyCache, name)
		} else {
			return item.dataKey, nil
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5) // TODO: What's the reasonable time here?
	defer cancel()
	// 1. get encrypted data key from database
	dataKey, err := s.Store.GetDataKey(ctx, name)
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
	s.dataKeyCache[name] = dataKeyCacheItem{
		expiry:  time.Now().Add(15 * time.Minute),
		dataKey: decrypted,
	}

	return decrypted, nil
}

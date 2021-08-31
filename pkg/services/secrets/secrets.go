package secrets

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	_ "github.com/grafana/grafana/pkg/services/secrets/database"
	"github.com/grafana/grafana/pkg/services/secrets/encryption"
	"github.com/grafana/grafana/pkg/services/secrets/types"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var logger = log.New("secrets")

type SecretsStore interface {
	GetDataKey(ctx context.Context, name string) (*types.DataKey, error)
	GetAllDataKeys(ctx context.Context) ([]*types.DataKey, error)
	CreateDataKey(ctx context.Context, dataKey types.DataKey) error
	DeleteDataKey(ctx context.Context, name string) error
}

type SecretsService struct {
	Store    SecretsStore                     `inject:""`
	Bus      bus.Bus                          `inject:""`
	Enc      encryption.EncryptionServiceImpl `inject:""`
	Settings setting.Provider                 `inject:""`

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
		"grafana-provider": newGrafanaProvider(s.Settings, s.Enc),
	}
	s.defaultProvider = "grafana-provider"
	logger.Debug("configured secrets provider", s.defaultProvider)

	s.dataKeyCache = make(map[string]dataKeyCacheItem)

	util.Encrypt = s.Encrypt
	util.Decrypt = s.Decrypt

	return nil
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
	encrypted, err := provider.Encrypt(dataKey)
	if err != nil {
		return nil, err
	}

	// 3. Store its encrypted value in db
	err = s.Store.CreateDataKey(ctx, types.DataKey{
		Active:        true, // TODO: right now we do never mark a key as deactivated
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

func newRandomDataKey() ([]byte, error) {
	rawDataKey := make([]byte, 16)
	_, err := rand.Read(rawDataKey)
	if err != nil {
		return nil, err
	}
	return rawDataKey, nil
}

var b64 = base64.RawStdEncoding

func (s *SecretsService) Encrypt(payload []byte, opt util.EncryptionOption) ([]byte, error) {
	scope := opt()
	keyName := fmt.Sprintf("%s/%s@%s", time.Now().Format("2006-01-02"), scope, s.defaultProvider)

	dataKey, err := s.dataKey(keyName)
	if err != nil {
		if errors.Is(err, types.ErrDataKeyNotFound) {
			dataKey, err = s.newDataKey(context.TODO(), keyName, scope)
			if err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}

	encrypted, err := s.Enc.Encrypt(payload, dataKey)
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
		return nil, fmt.Errorf("unable to decrypt empty payload")
	}

	var dataKey []byte

	if payload[0] != '#' {
		secretKey := s.Settings.KeyValue("security", "secret_key").Value()
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

		dataKey, err = s.dataKey(string(key))
		if err != nil {
			return nil, err
		}
	}

	return s.Enc.Decrypt(payload, dataKey)
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

	// 1. get encrypted data key from database
	dataKey, err := s.Store.GetDataKey(context.Background(), name)
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

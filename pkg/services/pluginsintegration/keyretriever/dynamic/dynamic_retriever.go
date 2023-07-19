package dynamic

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/signature/statickey"
	"github.com/grafana/grafana/pkg/setting"
)

const publicKeySyncInterval = 10 * 24 * time.Hour // 10 days

// ManifestKeys is the database representation of public keys
// used to verify plugin manifests.
type ManifestKeys struct {
	KeyID     string `json:"keyId"`
	PublicKey string `json:"public"`
	Since     int64  `json:"since"`
}

type KeyRetriever struct {
	cfg *setting.Cfg
	log log.Logger

	lock    sync.Mutex
	cli     http.Client
	kv      plugins.KeyStore
	hasKeys bool
}

var _ plugins.KeyRetriever = (*KeyRetriever)(nil)

func ProvideService(cfg *setting.Cfg, kv plugins.KeyStore) *KeyRetriever {
	kr := &KeyRetriever{
		cfg: cfg,
		log: log.New("plugin.signature.key_retriever"),
		cli: makeHttpClient(),
		kv:  kv,
	}
	return kr
}

// IsDisabled disables dynamic retrieval of public keys from the API server.
func (kr *KeyRetriever) IsDisabled() bool {
	return kr.cfg.PluginSkipPublicKeyDownload
}

func (kr *KeyRetriever) Run(ctx context.Context) error {
	// do an initial update if necessary
	err := kr.updateKeys(ctx)
	if err != nil {
		kr.log.Error("Error downloading plugin manifest keys", "error", err)
	}

	// calculate initial send delay
	lastUpdated, err := kr.kv.GetLastUpdated(ctx)
	if err != nil {
		return err
	}
	nextSendInterval := time.Until(lastUpdated.Add(publicKeySyncInterval))
	if nextSendInterval < time.Minute {
		nextSendInterval = time.Minute
	}

	downloadKeysTicker := time.NewTicker(nextSendInterval)
	defer downloadKeysTicker.Stop()

	select {
	case <-downloadKeysTicker.C:
		err = kr.updateKeys(ctx)
		if err != nil {
			kr.log.Error("Error downloading plugin manifest keys", "error", err)
		}

		if nextSendInterval != publicKeySyncInterval {
			nextSendInterval = publicKeySyncInterval
			downloadKeysTicker.Reset(nextSendInterval)
		}
	case <-ctx.Done():
		return ctx.Err()
	}

	return ctx.Err()
}

func (kr *KeyRetriever) updateKeys(ctx context.Context) error {
	kr.lock.Lock()
	defer kr.lock.Unlock()

	lastUpdated, err := kr.kv.GetLastUpdated(ctx)
	if err != nil {
		return err
	}
	if !kr.cfg.PluginForcePublicKeyDownload && time.Since(*lastUpdated) < publicKeySyncInterval {
		// Cache is still valid
		return nil
	}

	return kr.downloadKeys(ctx)
}

// Retrieve the key from the API and store it in the database
func (kr *KeyRetriever) downloadKeys(ctx context.Context) error {
	var data struct {
		Items []ManifestKeys
	}

	url, err := url.JoinPath(kr.cfg.GrafanaComURL, "/api/plugins/ci/keys") // nolint:gosec URL is provided by config
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}

	resp, err := kr.cli.Do(req)
	if err != nil {
		return err
	}
	defer func() {
		err := resp.Body.Close()
		if err != nil {
			kr.log.Warn("error closing response body", "error", err)
		}
	}()

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return err
	}

	if len(data.Items) == 0 {
		return errors.New("missing public key")
	}

	cachedKeys, err := kr.kv.ListKeys(ctx)
	if err != nil {
		return err
	}

	shouldKeep := make(map[string]bool)
	for _, key := range data.Items {
		err = kr.kv.Set(ctx, key.KeyID, key.PublicKey)
		if err != nil {
			return err
		}
		shouldKeep[key.KeyID] = true
	}

	// Delete keys that are no longer in the API
	for _, key := range cachedKeys {
		if !shouldKeep[key] {
			err = kr.kv.Del(ctx, key)
			if err != nil {
				return err
			}
		}
	}

	// Update the last updated timestamp
	return kr.kv.SetLastUpdated(ctx)
}

func (kr *KeyRetriever) ensureKeys(ctx context.Context) error {
	if kr.hasKeys {
		return nil
	}
	keys, err := kr.kv.ListKeys(ctx)
	if err != nil {
		return err
	}
	if len(keys) == 0 {
		// Populate with the default key
		err := kr.kv.Set(ctx, statickey.GetDefaultKeyID(), statickey.GetDefaultKey())
		if err != nil {
			return err
		}
	}
	kr.hasKeys = true
	return nil
}

// GetPublicKey loads public keys from:
//   - The hard-coded value if the feature flag is not enabled.
//   - A cached value from kv storage if it has been already retrieved. This cache is populated from the grafana.com API.
func (kr *KeyRetriever) GetPublicKey(ctx context.Context, keyID string) (string, error) {
	kr.lock.Lock()
	defer kr.lock.Unlock()

	err := kr.ensureKeys(ctx)
	if err != nil {
		return "", err
	}

	key, exist, err := kr.kv.Get(ctx, keyID)
	if err != nil {
		return "", err
	}
	if exist {
		return key, nil
	}

	return "", fmt.Errorf("missing public key for %s", keyID)
}

// Same configuration as pkg/plugins/repo/client.go
func makeHttpClient() http.Client {
	tr := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	return http.Client{
		Timeout:   10 * time.Second,
		Transport: tr,
	}
}

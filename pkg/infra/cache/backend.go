package cache

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"time"

	gocache "github.com/patrickmn/go-cache"

	"github.com/grafana/dskit/ring"
	"github.com/grafana/grafana/pkg/infra/remotecache"
)

type Backend remotecache.CacheStorage

func newLocalBackend() *localBackend {
	return &localBackend{
		store: gocache.New(5*time.Minute, 10*time.Minute),
	}
}

type localBackend struct {
	store *gocache.Cache
}

func (b *localBackend) Get(ctx context.Context, key string) ([]byte, error) {
	data, ok := b.store.Get(key)
	if !ok {
		return nil, remotecache.ErrCacheItemNotFound
	}

	return data.([]byte), nil
}

func (b *localBackend) Set(ctx context.Context, key string, value []byte, expire time.Duration) error {
	b.store.Set(key, value, expire)
	return nil

}

func (b *localBackend) Delete(ctx context.Context, key string) error {
	b.store.Delete(key)
	return nil
}

func (b *localBackend) Count(ctx context.Context, prefix string) (int64, error) {
	return 0, nil
}

func newRemoteBackend(inst *ring.InstanceDesc) *remoteBackend {
	url := getInstanceURL(inst)
	return &remoteBackend{
		url,
		&http.Client{
			Transport: &http.Transport{
				Proxy: http.ProxyFromEnvironment,
				DialContext: (&net.Dialer{
					Timeout:   4 * time.Second,
					KeepAlive: 15 * time.Second,
				}).DialContext,
				TLSHandshakeTimeout:   10 * time.Second,
				ExpectContinueTimeout: 1 * time.Second,
				MaxIdleConns:          100,
				IdleConnTimeout:       30 * time.Second,
			},
			Timeout: 5 * time.Second,
		},
	}
}

type remoteBackend struct {
	url    string
	client *http.Client
}

func (b *remoteBackend) Get(ctx context.Context, key string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, b.url+"/cache/"+key, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to delegate get cache: %w", err)
	}

	res, err := b.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to delegate get cache: %w", err)
	}

	if res.StatusCode != http.StatusOK {
		if res.StatusCode == http.StatusNotFound {
			return nil, remotecache.ErrCacheItemNotFound
		}
		return nil, fmt.Errorf("failed to delegate get cache: %s", res.Status)
	}

	var body getResponse
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, err
	}
	return body.Value, nil

}

func (b *remoteBackend) Set(ctx context.Context, key string, value []byte, expr time.Duration) error {
	buf := &bytes.Buffer{}
	if err := json.NewEncoder(buf).Encode(&setRequest{key, value, expr}); err != nil {
		return fmt.Errorf("failed to delegate set cache: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, b.url+"/cache/internal", buf)
	if err != nil {
		return fmt.Errorf("failed to delegate set cache: %w", err)
	}

	req.Header.Add("Content-Type", "applicaton/json")
	res, err := b.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delegate set cache: %w", err)
	}

	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to delegate set cache: %s", res.Status)
	}

	return nil
}

func (b *remoteBackend) Delete(ctx context.Context, key string) error {
	// TODO: url encode key
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, b.url+"/cache/"+key, nil)
	if err != nil {
		return fmt.Errorf("failed to delegate delete cache: %w", err)
	}

	res, err := b.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delegate delete cache: %w", err)
	}

	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to delegate delete cache: %s", res.Status)
	}

	return nil
}

func (b *remoteBackend) Count(ctx context.Context, prefix string) (int64, error) {
	return 0, nil
}

func getInstanceURL(inst *ring.InstanceDesc) string {
	return "http://" + net.JoinHostPort(inst.GetId(), httpPort)
}

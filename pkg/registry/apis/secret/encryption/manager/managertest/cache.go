package managertest

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
)

type NoopDataKeyCache struct {
}

func (c *NoopDataKeyCache) GetById(_ context.Context, namespace, id string) (encryption.DataKeyCacheEntry, bool, error) {
	return encryption.DataKeyCacheEntry{}, false, nil
}

func (c *NoopDataKeyCache) GetByLabel(_ context.Context, namespace, label string) (encryption.DataKeyCacheEntry, bool, error) {
	return encryption.DataKeyCacheEntry{}, false, nil
}

func (c *NoopDataKeyCache) Set(_ context.Context, namespace string, entry encryption.DataKeyCacheEntry) error {
	return nil
}

func (c *NoopDataKeyCache) RemoveExpired(_ context.Context) {
}

func (c *NoopDataKeyCache) Flush(_ context.Context, namespace string) {}

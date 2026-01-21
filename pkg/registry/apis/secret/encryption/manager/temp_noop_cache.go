package manager

import "github.com/grafana/grafana/pkg/registry/apis/secret/encryption"

// This is being used as the data key cache in both OSS and Enterprise while we discuss security requirements for DEK caching
type noopDataKeyCache struct {
}

func ProvideNoopDataKeyCache() encryption.DataKeyCache {
	return &noopDataKeyCache{}
}

func (c *noopDataKeyCache) GetById(_ string, _ string) (encryption.DataKeyCacheEntry, bool) {
	return encryption.DataKeyCacheEntry{}, false
}

func (c *noopDataKeyCache) GetByLabel(_ string, _ string) (encryption.DataKeyCacheEntry, bool) {
	return encryption.DataKeyCacheEntry{}, false
}

func (c *noopDataKeyCache) AddById(_ string, _ encryption.DataKeyCacheEntry) {}

func (c *noopDataKeyCache) AddByLabel(_ string, _ encryption.DataKeyCacheEntry) {}

func (c *noopDataKeyCache) RemoveExpired() {}

func (c *noopDataKeyCache) Flush(_ string) {}

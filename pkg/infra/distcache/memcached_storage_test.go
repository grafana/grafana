package distcache

import "testing"

func TestMemcachedCacheStorage(t *testing.T) {
	RunTestsForClient(t, createTestClient(t, "memcache"))
}

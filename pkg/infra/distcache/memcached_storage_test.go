package distcache

import "testing"

func TestMemcachedCacheStorage(t *testing.T) {
	runTestsForClient(t, createTestClient(t, "memcache"))
}

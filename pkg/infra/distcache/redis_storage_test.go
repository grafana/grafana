package distcache

import "testing"

func TestRedisCacheStorage(t *testing.T) {
	RunTestsForClient(t, createTestClient(t, "redis"))
}

package distcache

import "testing"

func TestRedisCacheStorage(t *testing.T) {
	runTestsForClient(t, createTestClient(t, "redis"))
}

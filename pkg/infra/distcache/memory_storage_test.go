package distcache

import "testing"

func TestMemoryCacheStorage(t *testing.T) {
	runTestsForClient(t, createTestClient(t, "memory"))
}

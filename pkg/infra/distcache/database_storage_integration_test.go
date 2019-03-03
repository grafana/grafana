package distcache

import "testing"

func TestIntegrationDatabaseCacheStorage(t *testing.T) {
	runTestsForClient(t, createTestClient(t, "database"))
}

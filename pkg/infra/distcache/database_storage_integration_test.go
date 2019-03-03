package distcache

import "testing"

func TestIntegrationDatabaseCacheStorage(t *testing.T) {

	RunTestsForClient(t, createTestClient(t, "database"))
}

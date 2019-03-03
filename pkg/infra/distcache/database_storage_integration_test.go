package distcache

import "testing"

func TestIntegrationDatabaseCacheStorage(t *testing.T) {

	client := createTestClient(t, "database")

	CanPutGetAndDeleteCachedObjects(t, client)
	CanNotFetchExpiredItems(t, client)
	CanSetInfiniteCacheExpiration(t, client)
}

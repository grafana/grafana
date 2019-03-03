package distcache

import "testing"

func TestRedisCacheStorage(t *testing.T) {

	client := createTestClient(t, "redis")

	CanPutGetAndDeleteCachedObjects(t, client)
	CanNotFetchExpiredItems(t, client)
	CanSetInfiniteCacheExpiration(t, client)
}

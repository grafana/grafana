package distcache

import "testing"

func TestMemcachedCacheStorage(t *testing.T) {

	client := createTestClient(t, "memcache")

	CanPutGetAndDeleteCachedObjects(t, client)
	CanNotFetchExpiredItems(t, client)
	CanSetInfiniteCacheExpiration(t, client)
}

package kvstore

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func createTestableKVStore(t *testing.T) KVStore {
	t.Helper()

	sqlStore := db.InitTestDB(t)

	kv := &kvStoreSQL{
		sqlStore: sqlStore,
		log:      log.New("infra.kvstore.sql"),
	}

	return kv
}

type TestCase struct {
	OrgId     int64
	Namespace string
	Key       string
	Revision  int64
}

func (t *TestCase) Value() string {
	return fmt.Sprintf("%d:%s:%s:%d", t.OrgId, t.Namespace, t.Key, t.Revision)
}

func TestIntegrationKVStore(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	kv := createTestableKVStore(t)

	ctx := context.Background()

	testCases := []*TestCase{
		{
			OrgId:     0,
			Namespace: "testing1",
			Key:       "key1",
		},
		{
			OrgId:     0,
			Namespace: "testing2",
			Key:       "key1",
		},
		{
			OrgId:     1,
			Namespace: "testing1",
			Key:       "key1",
		},
		{
			OrgId:     1,
			Namespace: "testing3",
			Key:       "key1",
		},
	}

	for _, tc := range testCases {
		err := kv.Set(ctx, tc.OrgId, tc.Namespace, tc.Key, tc.Value())
		require.NoError(t, err)
	}

	t.Run("get existing keys", func(t *testing.T) {
		for _, tc := range testCases {
			value, ok, err := kv.Get(ctx, tc.OrgId, tc.Namespace, tc.Key)
			require.NoError(t, err)
			require.True(t, ok)
			require.Equal(t, tc.Value(), value)
		}
	})

	t.Run("get nonexistent keys", func(t *testing.T) {
		tcs := []*TestCase{
			{
				OrgId:     0,
				Namespace: "testing1",
				Key:       "key2",
			},
			{
				OrgId:     1,
				Namespace: "testing2",
				Key:       "key1",
			},
			{
				OrgId:     1,
				Namespace: "testing3",
				Key:       "key2",
			},
		}

		for _, tc := range tcs {
			value, ok, err := kv.Get(ctx, tc.OrgId, tc.Namespace, tc.Key)
			require.Nil(t, err)
			require.False(t, ok)
			require.Equal(t, "", value)
		}
	})

	t.Run("modify existing key", func(t *testing.T) {
		tc := testCases[0]

		value, ok, err := kv.Get(ctx, tc.OrgId, tc.Namespace, tc.Key)
		require.NoError(t, err)
		require.True(t, ok)
		assert.Equal(t, tc.Value(), value)

		tc.Revision += 1

		err = kv.Set(ctx, tc.OrgId, tc.Namespace, tc.Key, tc.Value())
		require.NoError(t, err)

		value, ok, err = kv.Get(ctx, tc.OrgId, tc.Namespace, tc.Key)
		require.NoError(t, err)
		require.True(t, ok)
		assert.Equal(t, tc.Value(), value)
	})

	t.Run("use namespaced client", func(t *testing.T) {
		tc := testCases[0]

		client := WithNamespace(kv, tc.OrgId, tc.Namespace)

		value, ok, err := client.Get(ctx, tc.Key)
		require.NoError(t, err)
		require.True(t, ok)
		require.Equal(t, tc.Value(), value)

		tc.Revision += 1

		err = client.Set(ctx, tc.Key, tc.Value())
		require.NoError(t, err)

		value, ok, err = client.Get(ctx, tc.Key)
		require.NoError(t, err)
		require.True(t, ok)
		assert.Equal(t, tc.Value(), value)
	})

	t.Run("deleting keys", func(t *testing.T) {
		var stillHasKeys bool
		for _, tc := range testCases {
			if _, ok, err := kv.Get(ctx, tc.OrgId, tc.Namespace, tc.Key); err == nil && ok {
				stillHasKeys = true
				break
			}
		}
		require.True(t, stillHasKeys,
			"we are going to test key deletion, but there are no keys to delete in the database")
		for _, tc := range testCases {
			err := kv.Del(ctx, tc.OrgId, tc.Namespace, tc.Key)
			require.NoError(t, err)
		}
		for _, tc := range testCases {
			_, ok, err := kv.Get(ctx, tc.OrgId, tc.Namespace, tc.Key)
			require.NoError(t, err)
			require.False(t, ok, "all keys should be deleted at this point")
		}
	})

	t.Run("listing existing keys", func(t *testing.T) {
		kv := createTestableKVStore(t)

		ctx := context.Background()

		namespace, key := "listtest", "listtest"

		testCases := []*TestCase{
			{
				OrgId:     1,
				Namespace: namespace,
				Key:       key + "_1",
			},
			{
				OrgId:     2,
				Namespace: namespace,
				Key:       key + "_2",
			},
			{
				OrgId:     3,
				Namespace: namespace,
				Key:       key + "_3",
			},
			{
				OrgId:     4,
				Namespace: namespace,
				Key:       key + "_4",
			},
			{
				OrgId:     1,
				Namespace: namespace,
				Key:       "other_key",
			},
			{
				OrgId:     4,
				Namespace: namespace,
				Key:       "another_one",
			},
		}

		for _, tc := range testCases {
			err := kv.Set(ctx, tc.OrgId, tc.Namespace, tc.Key, tc.Value())
			require.NoError(t, err)
		}

		keys, err := kv.Keys(ctx, AllOrganizations, namespace, key[0:6])

		require.NoError(t, err)
		require.Len(t, keys, 4)

		found := 0

		for _, key := range keys {
			for _, tc := range testCases {
				if key.Key == tc.Key {
					found++
					break
				}
			}
		}

		require.Equal(t, 4, found, "querying with the wildcard should return 4 records")

		keys, err = kv.Keys(ctx, 1, namespace, key[0:6])

		require.NoError(t, err)
		require.Len(t, keys, 1, "querying for a specific org should return 1 record")

		keys, err = kv.Keys(ctx, AllOrganizations, "not_existing_namespace", "not_existing_key")
		require.NoError(t, err, "querying a not existing namespace and key should not throw an error")
		require.Len(t, keys, 0, "querying a not existing namespace and key should return an empty slice")
	})
}

func TestIntegrationGetItems(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	kv := createTestableKVStore(t)

	ctx := context.Background()

	testCases := []*TestCase{
		{
			OrgId:     1,
			Namespace: "testing1",
			Key:       "key1",
		},
		{
			OrgId:     2,
			Namespace: "testing1",
			Key:       "key1",
		},
		{
			OrgId:     2,
			Namespace: "testing1",
			Key:       "key2",
		},
	}

	for _, tc := range testCases {
		err := kv.Set(ctx, tc.OrgId, tc.Namespace, tc.Key, tc.Value())
		require.NoError(t, err)
	}

	t.Run("Get all values per org", func(t *testing.T) {
		for _, tc := range testCases {
			items, err := kv.GetAll(ctx, tc.OrgId, tc.Namespace)
			require.NoError(t, err)
			require.Equal(t, items[tc.OrgId][tc.Key], tc.Value())
		}
	})

	t.Run("Get all values for all orgs", func(t *testing.T) {
		items, err := kv.GetAll(ctx, AllOrganizations, "testing1")
		require.NoError(t, err)
		for _, tc := range testCases {
			require.Equal(t, items[tc.OrgId][tc.Key], tc.Value())
		}
	})
}

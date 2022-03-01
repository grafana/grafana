package kvstore

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func createTestableKVStore(t *testing.T) SecretsKVStore {
	t.Helper()

	sqlStore := sqlstore.InitTestDB(t)

	kv := &secretsKVStoreSQL{
		sqlStore: sqlStore,
		log:      log.New("secrets.kvstore"),
	}

	return kv
}

type TestCase struct {
	OrgId    int64
	Type     string
	Key      string
	Revision int64
}

func (t *TestCase) Value() string {
	return fmt.Sprintf("%d:%s:%s:%d", t.OrgId, t.Type, t.Key, t.Revision)
}

func TestKVStore(t *testing.T) {
	kv := createTestableKVStore(t)

	ctx := context.Background()

	testCases := []*TestCase{
		{
			OrgId: 0,
			Type:  "testing1",
			Key:   "key1",
		},
		{
			OrgId: 0,
			Type:  "testing2",
			Key:   "key1",
		},
		{
			OrgId: 1,
			Type:  "testing1",
			Key:   "key1",
		},
		{
			OrgId: 1,
			Type:  "testing3",
			Key:   "key1",
		},
	}

	for _, tc := range testCases {
		err := kv.Set(ctx, tc.OrgId, tc.Type, tc.Key, tc.Value())
		require.NoError(t, err)
	}

	t.Run("get existing keys", func(t *testing.T) {
		for _, tc := range testCases {
			value, ok, err := kv.Get(ctx, tc.OrgId, tc.Type, tc.Key)
			require.NoError(t, err)
			require.True(t, ok)
			require.Equal(t, tc.Value(), value)
		}
	})

	t.Run("get nonexistent keys", func(t *testing.T) {
		tcs := []*TestCase{
			{
				OrgId: 0,
				Type:  "testing1",
				Key:   "key2",
			},
			{
				OrgId: 1,
				Type:  "testing2",
				Key:   "key1",
			},
			{
				OrgId: 1,
				Type:  "testing3",
				Key:   "key2",
			},
		}

		for _, tc := range tcs {
			value, ok, err := kv.Get(ctx, tc.OrgId, tc.Type, tc.Key)
			require.Nil(t, err)
			require.False(t, ok)
			require.Equal(t, "", value)
		}
	})

	t.Run("modify existing key", func(t *testing.T) {
		tc := testCases[0]

		value, ok, err := kv.Get(ctx, tc.OrgId, tc.Type, tc.Key)
		require.NoError(t, err)
		require.True(t, ok)
		assert.Equal(t, tc.Value(), value)

		tc.Revision += 1

		err = kv.Set(ctx, tc.OrgId, tc.Type, tc.Key, tc.Value())
		require.NoError(t, err)

		value, ok, err = kv.Get(ctx, tc.OrgId, tc.Type, tc.Key)
		require.NoError(t, err)
		require.True(t, ok)
		assert.Equal(t, tc.Value(), value)
	})

	t.Run("use typed client", func(t *testing.T) {
		tc := testCases[0]

		client := WithType(kv, tc.OrgId, tc.Type)

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
			if _, ok, err := kv.Get(ctx, tc.OrgId, tc.Type, tc.Key); err == nil && ok {
				stillHasKeys = true
				break
			}
		}
		require.True(t, stillHasKeys,
			"we are going to test key deletion, but there are no keys to delete in the database")
		for _, tc := range testCases {
			err := kv.Del(ctx, tc.OrgId, tc.Type, tc.Key)
			require.NoError(t, err)
		}
		for _, tc := range testCases {
			_, ok, err := kv.Get(ctx, tc.OrgId, tc.Type, tc.Key)
			require.NoError(t, err)
			require.False(t, ok, "all keys should be deleted at this point")
		}
	})

	t.Run("listing existing keys", func(t *testing.T) {
		kv := createTestableKVStore(t)

		ctx := context.Background()

		typ, key := "listtest", "listtest"

		testCases := []*TestCase{
			{
				OrgId: 1,
				Type:  typ,
				Key:   key + "_1",
			},
			{
				OrgId: 2,
				Type:  typ,
				Key:   key + "_2",
			},
			{
				OrgId: 3,
				Type:  typ,
				Key:   key + "_3",
			},
			{
				OrgId: 4,
				Type:  typ,
				Key:   key + "_4",
			},
			{
				OrgId: 1,
				Type:  typ,
				Key:   "other_key",
			},
			{
				OrgId: 4,
				Type:  typ,
				Key:   "another_one",
			},
		}

		for _, tc := range testCases {
			err := kv.Set(ctx, tc.OrgId, tc.Type, tc.Key, tc.Value())
			require.NoError(t, err)
		}

		keys, err := kv.Keys(ctx, AllOrganizations, typ, key[0:6])

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

		keys, err = kv.Keys(ctx, 1, typ, key[0:6])

		require.NoError(t, err)
		require.Len(t, keys, 1, "querying for a specific org should return 1 record")

		keys, err = kv.Keys(ctx, AllOrganizations, "not_existing_type", "not_existing_key")
		require.NoError(t, err, "querying a not existing type and key should not throw an error")
		require.Len(t, keys, 0, "querying a not existing type and key should return an empty slice")
	})
}

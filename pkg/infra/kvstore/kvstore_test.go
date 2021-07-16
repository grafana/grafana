package kvstore

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func createTestableKVStore(t *testing.T) *KVStore {
	t.Helper()

	sqlstore := sqlstore.InitTestDB(t)

	kv := &KVStore{
		SQLStore: sqlstore,
	}

	kv.Init()

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

func TestKVStore(t *testing.T) {
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
			value, err := kv.Get(ctx, tc.OrgId, tc.Namespace, tc.Key)
			require.NoError(t, err)
			assert.Equal(t, tc.Value(), value)
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
			value, err := kv.Get(ctx, tc.OrgId, tc.Namespace, tc.Key)
			assert.Equal(t, ErrNotFound, err)
			assert.Equal(t, "", value)
		}
	})

	t.Run("modify existing key", func(t *testing.T) {
		tc := testCases[0]

		value, err := kv.Get(ctx, tc.OrgId, tc.Namespace, tc.Key)
		require.NoError(t, err)
		assert.Equal(t, tc.Value(), value)

		tc.Revision += 1

		err = kv.Set(ctx, tc.OrgId, tc.Namespace, tc.Key, tc.Value())
		require.NoError(t, err)

		value, err = kv.Get(ctx, tc.OrgId, tc.Namespace, tc.Key)
		require.NoError(t, err)
		assert.Equal(t, tc.Value(), value)
	})

	t.Run("use namespaced client", func(t *testing.T) {
		tc := testCases[0]

		client := kv.WithNamespace(tc.OrgId, tc.Namespace)

		value, err := client.Get(ctx, tc.Key)
		require.NoError(t, err)
		assert.Equal(t, tc.Value(), value)

		tc.Revision += 1

		err = client.Set(ctx, tc.Key, tc.Value())
		require.NoError(t, err)

		value, err = client.Get(ctx, tc.Key)
		require.NoError(t, err)
		assert.Equal(t, tc.Value(), value)
	})
}

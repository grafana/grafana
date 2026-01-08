package kvstore

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type TestCase struct {
	OrgId     int64
	Namespace string
	Type      string
	Revision  int64
}

func (t *TestCase) Value() string {
	return fmt.Sprintf("%d:%s:%s:%d", t.OrgId, t.Namespace, t.Type, t.Revision)
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationSecretsKVStoreSQL(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t)
	secretsService := manager.SetupTestService(t, fakes.NewFakeSecretsStore())
	kv := NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))

	ctx := context.Background()

	testCases := []*TestCase{
		{
			OrgId:     0,
			Namespace: "namespace1",
			Type:      "testing1",
		},
		{
			OrgId:     0,
			Namespace: "namespace2",
			Type:      "testing2",
		},
		{
			OrgId:     1,
			Namespace: "namespace1",
			Type:      "testing1",
		},
		{
			OrgId:     1,
			Namespace: "namespace3",
			Type:      "testing3",
		},
	}

	for _, tc := range testCases {
		err := kv.Set(ctx, tc.OrgId, tc.Namespace, tc.Type, tc.Value())
		require.NoError(t, err)
	}

	t.Run("get existing keys", func(t *testing.T) {
		for _, tc := range testCases {
			value, ok, err := kv.Get(ctx, tc.OrgId, tc.Namespace, tc.Type)
			require.NoError(t, err)
			require.True(t, ok)
			require.Equal(t, tc.Value(), value)
		}
	})

	t.Run("get nonexistent keys", func(t *testing.T) {
		tcs := []*TestCase{
			{
				OrgId:     0,
				Namespace: "namespace3",
				Type:      "testing3",
			},
			{
				OrgId:     1,
				Namespace: "namespace2",
				Type:      "testing2",
			},
			{
				OrgId:     2,
				Namespace: "namespace1",
				Type:      "testing1",
			},
		}

		for _, tc := range tcs {
			value, ok, err := kv.Get(ctx, tc.OrgId, tc.Namespace, tc.Type)
			require.Nil(t, err)
			require.False(t, ok)
			require.Equal(t, "", value)
		}
	})

	t.Run("modify existing key", func(t *testing.T) {
		tc := testCases[0]

		value, ok, err := kv.Get(ctx, tc.OrgId, tc.Namespace, tc.Type)
		require.NoError(t, err)
		require.True(t, ok)
		assert.Equal(t, tc.Value(), value)

		tc.Revision += 1

		err = kv.Set(ctx, tc.OrgId, tc.Namespace, tc.Type, tc.Value())
		require.NoError(t, err)

		value, ok, err = kv.Get(ctx, tc.OrgId, tc.Namespace, tc.Type)
		require.NoError(t, err)
		require.True(t, ok)
		assert.Equal(t, tc.Value(), value)
	})

	t.Run("use fixed client", func(t *testing.T) {
		tc := testCases[0]

		client := With(kv, tc.OrgId, tc.Namespace, tc.Type)
		fmt.Println(client.Namespace, client.OrgId, client.Type)

		value, ok, err := client.Get(ctx)
		require.NoError(t, err)
		require.True(t, ok)
		require.Equal(t, tc.Value(), value)

		tc.Revision += 1

		err = client.Set(ctx, tc.Value())
		require.NoError(t, err)

		value, ok, err = client.Get(ctx)
		require.NoError(t, err)
		require.True(t, ok)
		assert.Equal(t, tc.Value(), value)
	})

	t.Run("deleting keys", func(t *testing.T) {
		var stillHasKeys bool
		for _, tc := range testCases {
			if _, ok, err := kv.Get(ctx, tc.OrgId, tc.Namespace, tc.Type); err == nil && ok {
				stillHasKeys = true
				break
			}
		}
		require.True(t, stillHasKeys,
			"we are going to test key deletion, but there are no keys to delete in the database")
		for _, tc := range testCases {
			err := kv.Del(ctx, tc.OrgId, tc.Namespace, tc.Type)
			require.NoError(t, err)
		}
		for _, tc := range testCases {
			_, ok, err := kv.Get(ctx, tc.OrgId, tc.Namespace, tc.Type)
			require.NoError(t, err)
			require.False(t, ok, "all keys should be deleted at this point")
		}
	})

	t.Run("listing existing keys", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		secretsService := manager.SetupTestService(t, fakes.NewFakeSecretsStore())
		kv := NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))

		ctx := context.Background()

		namespace, typ := "listtest", "listtest"

		testCases := []*TestCase{
			{
				OrgId:     1,
				Type:      typ,
				Namespace: namespace,
			},
			{
				OrgId:     2,
				Type:      typ,
				Namespace: namespace,
			},
			{
				OrgId:     3,
				Type:      typ,
				Namespace: namespace,
			},
			{
				OrgId:     4,
				Type:      typ,
				Namespace: namespace,
			},
			{
				OrgId:     1,
				Type:      typ,
				Namespace: "other_key",
			},
			{
				OrgId:     4,
				Type:      typ,
				Namespace: "another_one",
			},
		}

		for _, tc := range testCases {
			err := kv.Set(ctx, tc.OrgId, tc.Namespace, tc.Type, tc.Value())
			require.NoError(t, err)
		}

		keys, err := kv.Keys(ctx, AllOrganizations, namespace, typ)

		require.NoError(t, err)
		require.Len(t, keys, 4)

		found := 0

		for _, key := range keys {
			for _, tc := range testCases {
				if key.OrgId == tc.OrgId && key.Namespace == tc.Namespace && key.Type == tc.Type {
					found++
					break
				}
			}
		}

		require.Equal(t, 4, found, "querying for all orgs should return 4 records")

		keys, err = kv.Keys(ctx, 1, namespace, typ)

		require.NoError(t, err)
		require.Len(t, keys, 1, "querying for a specific org should return 1 record")

		keys, err = kv.Keys(ctx, AllOrganizations, "not_existing_namespace", "not_existing_type")
		require.NoError(t, err, "querying a not existing namespace should not throw an error")
		require.Len(t, keys, 0, "querying a not existing namespace should return an empty slice")
	})

	t.Run("getting all secrets", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		secretsService := manager.SetupTestService(t, fakes.NewFakeSecretsStore())
		kv := NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))

		ctx := context.Background()

		namespace, typ := "listtest", "listtest"

		testCases := []*TestCase{
			{
				OrgId:     1,
				Type:      typ,
				Namespace: namespace,
			},
			{
				OrgId:     2,
				Type:      typ,
				Namespace: namespace,
			},
			{
				OrgId:     3,
				Type:      typ,
				Namespace: namespace,
			},
			{
				OrgId:     4,
				Type:      typ,
				Namespace: namespace,
			},
			{
				OrgId:     1,
				Type:      typ,
				Namespace: "other_key",
			},
			{
				OrgId:     4,
				Type:      typ,
				Namespace: "another_one",
			},
		}

		for _, tc := range testCases {
			err := kv.Set(ctx, tc.OrgId, tc.Namespace, tc.Type, tc.Value())
			require.NoError(t, err)
		}

		secrets, err := kv.GetAll(ctx)

		require.NoError(t, err)
		require.Len(t, secrets, 6)

		found := 0

		for _, s := range secrets {
			for _, tc := range testCases {
				if *s.OrgId == tc.OrgId &&
					*s.Namespace == tc.Namespace &&
					*s.Type == tc.Type {
					require.Equal(t, tc.Value(), s.Value, "secret found but value is not equals")
					found++
					break
				}
			}
		}

		require.Equal(t, 6, found, "querying for all secrets should return 6 records")
	})
}

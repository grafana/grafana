package sql

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	dbsql "github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationListIter(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()

	grafanaDB := db.InitTestDB(t)

	resourceDBProvider, err := dbimpl.ProvideResourceDB(grafanaDB, setting.ProvideService(setting.NewCfg()), tracing.NewNoopTracerService())
	require.NoError(t, err)

	resourceDB, err := resourceDBProvider.Init(ctx)
	require.NoError(t, err)

	dialect := sqltemplate.DialectForDriver(resourceDB.DriverName())

	testData := []struct {
		guid            string
		resourceVersion int64
		namespace       string
		resource        string
		group           string
		name            string
		folder          string
		value           []byte
	}{
		{
			guid:            "guid-1",
			resourceVersion: 100,
			namespace:       "namespace-1",
			resource:        "resource-1",
			group:           "group-1",
			name:            "name-1",
			folder:          "folder-1",
			value:           []byte(`{"test":"value-1"}`),
		},
		{
			guid:            "guid-2",
			resourceVersion: 200,
			namespace:       "namespace-2",
			resource:        "resource-2",
			group:           "group-2",
			name:            "name-2",
			folder:          "folder-2",
			value:           []byte(`{"test":"value-2"}`),
		},
	}

	// Insert the test data directly with SQL to include resource_version
	err = resourceDB.WithTx(ctx, nil, func(ctx context.Context, tx dbsql.Tx) error {
		for _, item := range testData {
			_, err := dbutil.Exec(ctx, tx, sqlResourceInsert, sqlResourceRequest{
				SQLTemplate:     sqltemplate.New(dialect),
				GUID:            item.guid,
				Folder:          item.folder,
				ResourceVersion: item.resourceVersion,
				WriteEvent: resource.WriteEvent{
					Key: &resourcepb.ResourceKey{
						Namespace: item.namespace,
						Resource:  item.resource,
						Group:     item.group,
						Name:      item.name,
					},
					Value:      item.value,
					PreviousRV: 0,
				},
			})
			if err != nil {
				return fmt.Errorf("failed to insert test data: %w", err)
			}
			_, err = dbutil.Exec(ctx, tx, sqlResourceUpdate, sqlResourceRequest{
				SQLTemplate:     sqltemplate.New(dialect),
				GUID:            item.guid,
				ResourceVersion: item.resourceVersion,
				Folder:          item.folder,
				WriteEvent: resource.WriteEvent{
					Key: &resourcepb.ResourceKey{
						Namespace: item.namespace,
						Resource:  item.resource,
						Group:     item.group,
						Name:      item.name,
					},
					Value:      item.value,
					PreviousRV: item.resourceVersion,
					Type:       1,
				},
			})
			if err != nil {
				return fmt.Errorf("failed to insert resource version: %w", err)
			}
		}
		return err
	})
	require.NoError(t, err)

	t.Run("Next() iterates through results", func(t *testing.T) {
		listReq := sqlResourceListRequest{
			SQLTemplate: sqltemplate.New(dialect),
			Request:     new(resourcepb.ListRequest),
		}
		rows, err := dbutil.QueryRows(ctx, resourceDB, sqlResourceList, listReq)
		require.NoError(t, err)

		iter := &listIter{
			rows:    rows,
			listRV:  300,
			sortAsc: true,
		}

		// First row.
		require.True(t, iter.Next())
		require.NoError(t, iter.Error())
		require.Equal(t, "guid-1", iter.guid)
		require.Equal(t, int64(100), iter.ResourceVersion())
		require.Equal(t, "namespace-1", iter.Namespace())
		require.Equal(t, "resource-1", iter.resource)
		require.Equal(t, "group-1", iter.group)
		require.Equal(t, "name-1", iter.Name())
		require.Equal(t, "folder-1", iter.Folder())
		require.Equal(t, []byte(`{"test":"value-1"}`), iter.Value())

		// Second row.
		require.True(t, iter.Next())
		require.NoError(t, iter.Error())
		require.Equal(t, "guid-2", iter.guid)
		require.Equal(t, int64(200), iter.ResourceVersion())
		require.Equal(t, "namespace-2", iter.Namespace())
		require.Equal(t, "resource-2", iter.resource)
		require.Equal(t, "group-2", iter.group)
		require.Equal(t, "name-2", iter.Name())
		require.Equal(t, "folder-2", iter.Folder())
		require.Equal(t, []byte(`{"test":"value-2"}`), iter.Value())

		// No more rows.
		require.False(t, iter.Next())
		require.NoError(t, iter.Error())
	})

	t.Run("Next() returns false when no rows", func(t *testing.T) {
		listReq := sqlResourceListRequest{
			SQLTemplate: sqltemplate.New(dialect),
			Request: &resourcepb.ListRequest{
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{
						// Add a filter for a namespace that doesn't exist.
						Namespace: "non-existent-namespace",
					},
				},
			},
		}
		rows, err := dbutil.QueryRows(ctx, resourceDB, sqlResourceList, listReq)
		require.NoError(t, err)

		iter := &listIter{
			rows:    rows,
			listRV:  300,
			sortAsc: true,
		}

		require.False(t, iter.Next())
		require.NoError(t, iter.Error())
	})

	t.Run("ContinueToken returns encoded token", func(t *testing.T) {
		listReq := sqlResourceListRequest{
			SQLTemplate: sqltemplate.New(dialect),
			Request:     new(resourcepb.ListRequest),
		}

		rows, err := dbutil.QueryRows(ctx, resourceDB, sqlResourceList, listReq)
		require.NoError(t, err)

		iter := &listIter{
			rows:    rows,
			listRV:  300,
			sortAsc: true,
		}

		require.True(t, iter.Next())

		token := iter.ContinueToken()

		var actual resource.ContinueToken
		b, err := base64.StdEncoding.DecodeString(token)
		require.NoError(t, err)

		err = json.Unmarshal(b, &actual)
		require.NoError(t, err)

		expected := resource.ContinueToken{
			ResourceVersion: 300,
			StartOffset:     1,
			SortAscending:   true,
		}

		require.Equal(t, expected, actual)
	})

	t.Run("ContinueToken uses the current row's RV", func(t *testing.T) {
		listReq := sqlResourceListRequest{
			SQLTemplate: sqltemplate.New(dialect),
			Request:     new(resourcepb.ListRequest),
		}

		rows, err := dbutil.QueryRows(ctx, resourceDB, sqlResourceList, listReq)
		require.NoError(t, err)

		iter := &listIter{
			rows:         rows,
			listRV:       300,
			sortAsc:      true,
			useCurrentRV: true, // use the current RV for the continue token instead of the listRV
		}

		require.True(t, iter.Next())

		token := iter.ContinueToken()

		var actual resource.ContinueToken
		b, err := base64.StdEncoding.DecodeString(token)
		require.NoError(t, err)

		err = json.Unmarshal(b, &actual)
		require.NoError(t, err)

		expected := resource.ContinueToken{
			ResourceVersion: 100,
			StartOffset:     1,
			SortAscending:   true,
		}

		require.Equal(t, expected, actual)
	})
}

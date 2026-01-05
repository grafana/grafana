package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	sqldb "github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func NewTestSqlKvBackend(t *testing.T, ctx context.Context) (resource.KVBackend, sqldb.DB) {
	dbstore := db.InitTestDB(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)
	kv, err := resource.NewSQLKV(eDB)
	require.NoError(t, err)
	kvOpts := resource.KVBackendOptions{
		KvStore: kv,
	}
	backend, err := resource.NewKVStorageBackend(kvOpts)
	require.NoError(t, err)
	db, err := eDB.Init(ctx)
	require.NoError(t, err)
	return backend, db
}

func RunSQLStorageBackendCompatibilityTest(t *testing.T, newSqlBackend, newKvBackend NewBackendWithDBFunc, opts *TestOptions) {
	if opts == nil {
		opts = &TestOptions{}
	}

	if opts.NSPrefix == "" {
		opts.NSPrefix = GenerateRandomNSPrefix()
	}

	t.Logf("Running tests with namespace prefix: %s", opts.NSPrefix)

	cases := []struct {
		name string
		fn   func(*testing.T, resource.StorageBackend, string, sqldb.DB)
	}{
		{TestKeyPathGeneration, runTestIntegrationBackendKeyPathGeneration},
	}

	for _, tc := range cases {
		if shouldSkip := opts.SkipTests[tc.name]; shouldSkip {
			t.Logf("Skipping test: %s", tc.name)
			continue
		}

		t.Run(tc.name, func(t *testing.T) {
			kvbackend, db := newKvBackend(context.Background())
			sqlbackend, _ := newSqlBackend(context.Background())
			tc.fn(t, kvbackend, opts.NSPrefix, db)
		})
	}
}

func runTestIntegrationBackendKeyPathGeneration(t *testing.T, backend resource.StorageBackend, nsPrefix string, db sqldb.DB) {
	ctx := testutil.NewDefaultTestContext(t)

	t.Run("Create resource", func(t *testing.T) {
		// Create a test resource
		key := &resourcepb.ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
			Namespace: nsPrefix + "-default",
			Name:      "test-playlist-crud",
		}

		// Create the K8s unstructured object
		testObj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "playlist.grafana.app/v0alpha1",
				"kind":       "Playlist",
				"metadata": map[string]interface{}{
					"name":      "test-playlist-crud",
					"namespace": nsPrefix + "-default",
					"uid":       "test-uid-crud-123",
				},
				"spec": map[string]interface{}{
					"title": "My Test Playlist",
				},
			},
		}

		// Get metadata accessor
		metaAccessor, err := utils.MetaAccessor(testObj)
		require.NoError(t, err)

		// Serialize to JSON
		jsonBytes, err := testObj.MarshalJSON()
		require.NoError(t, err)

		// Create WriteEvent
		writeEvent := resource.WriteEvent{
			Type:       resourcepb.WatchEvent_ADDED,
			Key:        key,
			Value:      jsonBytes,
			Object:     metaAccessor,
			PreviousRV: 0, // Always 0 for new resources
			GUID:       "create-guid-crud-123",
		}

		// Create the resource using WriteEvent
		createRV, err := backend.WriteEvent(ctx, writeEvent)
		require.NoError(t, err)
		require.Greater(t, createRV, int64(0))

		// Verify created resource key_path
		verifyKeyPath(t, db, ctx, key, "created", createRV, "")

		t.Run("Update resource", func(t *testing.T) {
			// Update the resource
			testObj.Object["spec"] = map[string]interface{}{
				"title": "My Updated Playlist",
			}

			updatedMetaAccessor, err := utils.MetaAccessor(testObj)
			require.NoError(t, err)

			updatedJsonBytes, err := testObj.MarshalJSON()
			require.NoError(t, err)

			updateEvent := resource.WriteEvent{
				Type:       resourcepb.WatchEvent_MODIFIED,
				Key:        key,
				Value:      updatedJsonBytes,
				Object:     updatedMetaAccessor,
				PreviousRV: createRV,
				GUID:       fmt.Sprintf("update-guid-%d", createRV),
			}

			// Update the resource
			updateRV, err := backend.WriteEvent(ctx, updateEvent)
			require.NoError(t, err)
			require.Greater(t, updateRV, createRV)

			// Verify updated resource key_path
			verifyKeyPath(t, db, ctx, key, "updated", updateRV, "")

			t.Run("Delete resource", func(t *testing.T) {
				deleteEvent := resource.WriteEvent{
					Type:       resourcepb.WatchEvent_DELETED,
					Key:        key,
					Value:      updatedJsonBytes, // Keep the last known value
					Object:     updatedMetaAccessor,
					PreviousRV: updateRV,
					GUID:       fmt.Sprintf("delete-guid-%d", updateRV),
				}

				// Delete the resource
				deleteRV, err := backend.WriteEvent(ctx, deleteEvent)
				require.NoError(t, err)
				require.Greater(t, deleteRV, updateRV)

				// Verify deleted resource key_path
				verifyKeyPath(t, db, ctx, key, "deleted", deleteRV, "")
			})
		})
	})

	t.Run("Resource with folder", func(t *testing.T) {
		// Create a resource in a folder
		folderKey := &resourcepb.ResourceKey{
			Group:     "dashboard.grafana.app",
			Resource:  "dashboards",
			Namespace: nsPrefix + "-default",
			Name:      "my-dashboard",
		}

		// Create dashboard object with folder
		dashboardObj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "dashboard.grafana.app/v0alpha1",
				"kind":       "Dashboard",
				"metadata": map[string]interface{}{
					"name":      "my-dashboard",
					"namespace": nsPrefix + "-default",
					"uid":       "dash-uid-456",
					"annotations": map[string]interface{}{
						"grafana.app/folder": "test-folder",
					},
				},
				"spec": map[string]interface{}{
					"title": "My Dashboard",
				},
			},
		}

		folderMetaAccessor, err := utils.MetaAccessor(dashboardObj)
		require.NoError(t, err)

		folderJsonBytes, err := dashboardObj.MarshalJSON()
		require.NoError(t, err)

		folderWriteEvent := resource.WriteEvent{
			Type:       resourcepb.WatchEvent_ADDED,
			Key:        folderKey,
			Value:      folderJsonBytes,
			Object:     folderMetaAccessor,
			PreviousRV: 0,
			GUID:       "folder-guid-456",
		}

		// Create the dashboard in folder
		folderRV, err := backend.WriteEvent(ctx, folderWriteEvent)
		require.NoError(t, err)
		require.Greater(t, folderRV, int64(0))

		// Verify folder resource key_path includes folder
		verifyKeyPath(t, db, ctx, folderKey, "created", folderRV, "test-folder")
	})
}

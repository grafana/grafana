package resourcepermission

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegration_ResourcePermSqlBackend_ReadResource(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	backend := setupBackend(t)
	sql, err := backend.dbProvider(context.Background())
	require.NoError(t, err)
	setupTestRoles(t, sql.DB)

	updated1 := time.Date(2025, 9, 2, 0, 0, 0, 0, time.UTC)
	updated2 := time.Date(2025, 9, 3, 0, 0, 0, 0, time.UTC) // managed role for team 1 has a later updated permission

	t.Run("ReadResource - Invalid namespace", func(t *testing.T) {
		resp := backend.ReadResource(context.Background(), &resourcepb.ReadRequest{
			Key: &resourcepb.ResourceKey{Name: "folder.grafana.app-folders-fold1", Namespace: "invalid"},
		})
		require.NotNil(t, resp)
		require.NotNil(t, resp.Error)
		require.Contains(t, resp.Error.Message, errInvalidNamespace.Error())
		require.Equal(t, int32(400), resp.Error.Code)
	})

	t.Run("ReadResource - Get fold1 resource permissions", func(t *testing.T) {
		resp := backend.ReadResource(context.Background(), &resourcepb.ReadRequest{
			Key: &resourcepb.ResourceKey{Name: "folder.grafana.app-folders-fold1", Namespace: "default"},
		})

		require.NotNil(t, resp)
		require.Nil(t, resp.Error)
		require.NotNil(t, resp.Value)
		require.Equal(t, updated1.UnixMilli(), resp.ResourceVersion)

		var permission v0alpha1.ResourcePermission
		err := json.Unmarshal(resp.Value, &permission)
		require.NoError(t, err)
		require.Equal(t, "folder.grafana.app-folders-fold1", permission.Name)
		require.Len(t, permission.Spec.Permissions, 1)
		require.Equal(t, "user-1", permission.Spec.Permissions[0].Name)
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindUser, permission.Spec.Permissions[0].Kind)
		require.Equal(t, "view", permission.Spec.Permissions[0].Verb)
	})

	t.Run("ReadResource - Get fold1 in org-2 resource permissions", func(t *testing.T) {
		resp := backend.ReadResource(context.Background(), &resourcepb.ReadRequest{
			Key: &resourcepb.ResourceKey{Name: "folder.grafana.app-folders-fold1", Namespace: "org-2"},
		})

		require.NotNil(t, resp)
		require.Nil(t, resp.Error)
		require.NotNil(t, resp.Value)
		require.Equal(t, updated1.UnixMilli(), resp.ResourceVersion)

		var permission v0alpha1.ResourcePermission
		err := json.Unmarshal(resp.Value, &permission)
		require.NoError(t, err)
		require.Equal(t, "folder.grafana.app-folders-fold1", permission.Name)
		require.Len(t, permission.Spec.Permissions, 1)
		require.Equal(t, "user-2", permission.Spec.Permissions[0].Name)
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindUser, permission.Spec.Permissions[0].Kind)
		require.Equal(t, "edit", permission.Spec.Permissions[0].Verb)
	})

	t.Run("ReadResource - Get dash1 resource permissions", func(t *testing.T) {
		resp := backend.ReadResource(context.Background(), &resourcepb.ReadRequest{
			Key: &resourcepb.ResourceKey{Name: "dashboard.grafana.app-dashboards-dash1", Namespace: "default"},
		})

		require.NotNil(t, resp)
		require.Nil(t, resp.Error)
		require.NotNil(t, resp.Value)
		require.Equal(t, updated2.UnixMilli(), resp.ResourceVersion)

		var permission v0alpha1.ResourcePermission
		err := json.Unmarshal(resp.Value, &permission)
		require.NoError(t, err)
		require.Equal(t, "dashboard.grafana.app-dashboards-dash1", permission.Name)
		require.Len(t, permission.Spec.Permissions, 4)

		require.Equal(t, "Editor", permission.Spec.Permissions[0].Name)
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindBasicRole, permission.Spec.Permissions[0].Kind)
		require.Equal(t, "edit", permission.Spec.Permissions[0].Verb)

		require.Equal(t, "sa-1", permission.Spec.Permissions[1].Name)
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount, permission.Spec.Permissions[1].Kind)
		require.Equal(t, "view", permission.Spec.Permissions[1].Verb)

		require.Equal(t, "team-1", permission.Spec.Permissions[2].Name)
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindTeam, permission.Spec.Permissions[2].Kind)
		require.Equal(t, "admin", permission.Spec.Permissions[2].Verb)

		require.Equal(t, "user-1", permission.Spec.Permissions[3].Name)
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindUser, permission.Spec.Permissions[3].Kind)
		require.Equal(t, "edit", permission.Spec.Permissions[3].Verb)
	})
}

func TestWriteEvent_Add(t *testing.T) {
	store := db.InitTestDB(t)

	timeNow = func() time.Time {
		return time.Date(2025, 8, 28, 17, 13, 0, 0, time.UTC)
	}

	sqlHelper := &legacysql.LegacyDatabaseHelper{
		DB:    store,
		Table: func(name string) string { return name },
	}

	dbProvider := func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return sqlHelper, nil
	}

	t.Run("should error with invalid namespace", func(t *testing.T) {
		backend := ProvideStorageBackend(dbProvider)

		rv, err := backend.WriteEvent(context.Background(), resource.WriteEvent{
			Type: resourcepb.WatchEvent_ADDED,
			Key:  &resourcepb.ResourceKey{Name: "folder.grafana.app-folders-fold1", Namespace: "invalid"},
		})

		require.Zero(t, rv)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), "requires a valid namespace")
	})

	t.Run("should error if there is no permission", func(t *testing.T) {
		backend := ProvideStorageBackend(dbProvider)

		resourcePerm, err := utils.MetaAccessor(&v0alpha1.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "folder.grafana.app-folders-fold1",
				Namespace: "default",
			},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource: v0alpha1.ResourcePermissionspecResource{
					ApiGroup: "folder.grafana.app",
					Resource: "folders",
					Name:     "fold1",
				},
			},
		})
		require.NoError(t, err)

		gr := v0alpha1.ResourcePermissionInfo.GroupResource()
		rv, err := backend.WriteEvent(context.Background(), resource.WriteEvent{
			Type:   resourcepb.WatchEvent_ADDED,
			Key:    &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Name: "folder.grafana.app-folders-fold1", Namespace: "default"},
			Object: resourcePerm,
		})
		require.Zero(t, rv)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), errInvalidSpec.Error())
	})

	t.Run("should error if name and spec do not match", func(t *testing.T) {
		backend := ProvideStorageBackend(dbProvider)

		resourcePerm, err := utils.MetaAccessor(&v0alpha1.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "folder.grafana.app-folders-fold1",
				Namespace: "default",
			},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource: v0alpha1.ResourcePermissionspecResource{
					ApiGroup: "folder.grafana.app",
					Resource: "folders",
					Name:     "fold2",
				},
				Permissions: []v0alpha1.ResourcePermissionspecPermission{
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
						Name: "Viewer",
						Verb: "Admin",
					},
				},
			},
		})
		require.NoError(t, err)

		gr := v0alpha1.ResourcePermissionInfo.GroupResource()
		rv, err := backend.WriteEvent(context.Background(), resource.WriteEvent{
			Type:   resourcepb.WatchEvent_ADDED,
			Key:    &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Name: "folder.grafana.app-folders-fold1", Namespace: "default"},
			Object: resourcePerm,
		})
		require.Zero(t, rv)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), errInvalidSpec.Error())
	})

	t.Run("should error if resource name is empty", func(t *testing.T) {
		backend := ProvideStorageBackend(dbProvider)

		resourcePerm, err := utils.MetaAccessor(&v0alpha1.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "folder.grafana.app-folders-",
				Namespace: "default",
			},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource: v0alpha1.ResourcePermissionspecResource{
					ApiGroup: "folder.grafana.app",
					Resource: "folders",
					Name:     "",
				},
				Permissions: []v0alpha1.ResourcePermissionspecPermission{
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
						Name: "Viewer",
						Verb: "Admin",
					},
				},
			},
		})
		require.NoError(t, err)

		gr := v0alpha1.ResourcePermissionInfo.GroupResource()
		rv, err := backend.WriteEvent(context.Background(), resource.WriteEvent{
			Type:   resourcepb.WatchEvent_ADDED,
			Key:    &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Name: "folder.grafana.app-folders-", Namespace: "default"},
			Object: resourcePerm,
		})
		require.Zero(t, rv)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), errInvalidName.Error())
	})

	t.Run("should error if the resource is unknown", func(t *testing.T) {
		backend := ProvideStorageBackend(dbProvider)

		resourcePerm, err := utils.MetaAccessor(&v0alpha1.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "unknown.grafana.app-unknown-ukn1",
				Namespace: "default",
			},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource: v0alpha1.ResourcePermissionspecResource{
					ApiGroup: "unknown.grafana.app",
					Resource: "unknown",
					Name:     "ukn1",
				},
				Permissions: []v0alpha1.ResourcePermissionspecPermission{
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
						Name: "Viewer",
						Verb: "Admin",
					},
				},
			},
		})
		require.NoError(t, err)

		gr := v0alpha1.ResourcePermissionInfo.GroupResource()
		rv, err := backend.WriteEvent(context.Background(), resource.WriteEvent{
			Type:   resourcepb.WatchEvent_ADDED,
			Key:    &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Name: "unknown.grafana.app-unknown-ukn1", Namespace: "default"},
			Object: resourcePerm,
		})
		require.Zero(t, rv)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), errUnknownGroupResource.Error())
	})

	t.Run("should work with valid resource permission", func(t *testing.T) {
		backend := ProvideStorageBackend(dbProvider)
		backend.identityStore = NewFakeIdentityStore(t)

		resourcePerm, err := utils.MetaAccessor(&v0alpha1.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "folder.grafana.app-folders-fold1",
				Namespace: "default",
			},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource: v0alpha1.ResourcePermissionspecResource{
					ApiGroup: "folder.grafana.app",
					Resource: "folders",
					Name:     "fold1",
				},
				Permissions: []v0alpha1.ResourcePermissionspecPermission{
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
						Name: "Viewer",
						Verb: "Admin",
					},
				},
			},
		})
		require.NoError(t, err)

		gr := v0alpha1.ResourcePermissionInfo.GroupResource()
		rv, err := backend.WriteEvent(context.Background(), resource.WriteEvent{
			Type:   resourcepb.WatchEvent_ADDED,
			Key:    &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Name: "folder.grafana.app-folders-fold1", Namespace: "default"},
			Object: resourcePerm,
		})

		require.NoError(t, err)
		require.Equal(t, timeNow().UnixMilli(), rv)

		t.Run("Should error on duplicate add", func(t *testing.T) {
			rv, err := backend.WriteEvent(context.Background(), resource.WriteEvent{
				Type:   resourcepb.WatchEvent_ADDED,
				Key:    &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Name: "folder.grafana.app-folders-fold1", Namespace: "default"},
				Object: resourcePerm,
			})

			require.NotNil(t, err)
			require.Contains(t, err.Error(), errConflict.Error())
			require.Zero(t, rv)
		})
	})
}

func TestIntegration_ResourcePermSqlBackend_ListIterator(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// No result => list resource version should be current time
	now := time.Date(2025, 9, 9, 0, 0, 0, 0, time.UTC)
	timeNow = func() time.Time {
		return now
	}

	backend := setupBackend(t)
	sql, err := backend.dbProvider(context.Background())
	require.NoError(t, err)
	setupTestRoles(t, sql.DB)

	gr := v0alpha1.ResourcePermissionInfo.GroupResource()

	t.Run("Should error with invalid namespace", func(t *testing.T) {
		req := &resourcepb.ListRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Group:     gr.Group,
					Resource:  gr.Resource,
					Namespace: "invalid",
				},
			},
			Limit: 10,
		}

		callbackCalled := false
		count, err := backend.ListIterator(context.Background(), req, func(resource.ListIterator) error {
			callbackCalled = true
			return nil
		})

		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid namespace")
		require.Zero(t, count)
		require.False(t, callbackCalled)
	})

	t.Run("Should error with invalid continue token", func(t *testing.T) {
		req := &resourcepb.ListRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Group:     gr.Group,
					Resource:  gr.Resource,
					Namespace: "default",
				},
			},
			NextPageToken: "invalid-token",
			Limit:         10,
		}

		callbackCalled := false
		count, err := backend.ListIterator(context.Background(), req, func(resource.ListIterator) error {
			callbackCalled = true
			return nil
		})

		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid continue token")
		require.Zero(t, count)
		require.False(t, callbackCalled)
	})

	t.Run("Should list all resources for org-1", func(t *testing.T) {
		req := &resourcepb.ListRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Group:     gr.Group,
					Resource:  gr.Resource,
					Namespace: "default",
				},
			},
			Limit: 100,
		}

		var results []v0alpha1.ResourcePermission
		listRV, err := backend.ListIterator(context.Background(), req, func(it resource.ListIterator) error {
			for it.Next() {
				var perm v0alpha1.ResourcePermission
				err := json.Unmarshal(it.Value(), &perm)
				require.NoError(t, err)
				results = append(results, perm)

				// Test iterator methods
				require.NotEmpty(t, it.Name())
				require.Equal(t, "default", it.Namespace())
				require.NotZero(t, it.ResourceVersion())
				require.Empty(t, it.Folder()) // ResourcePermissions don't have folders
			}
			return it.Error()
		})

		require.NoError(t, err)
		require.Equal(t, updated.UnixMilli(), listRV)
		require.Len(t, results, 2)

		// Results should be sorted by scope (alphabetically)
		require.Equal(t, "dashboard.grafana.app-dashboards-dash1", results[0].Name)
		require.Equal(t, "folder.grafana.app-folders-fold1", results[1].Name)

		// Verify dash1 permissions
		require.Len(t, results[0].Spec.Permissions, 4)
		require.Equal(t, "dashboard.grafana.app", results[0].Spec.Resource.ApiGroup)
		require.Equal(t, "dashboards", results[0].Spec.Resource.Resource)
		require.Equal(t, "dash1", results[0].Spec.Resource.Name)

		// Verify fold1 permissions
		require.Len(t, results[1].Spec.Permissions, 1)
		require.Equal(t, "folder.grafana.app", results[1].Spec.Resource.ApiGroup)
		require.Equal(t, "folders", results[1].Spec.Resource.Resource)
		require.Equal(t, "fold1", results[1].Spec.Resource.Name)
	})

	t.Run("Should handle pagination with continue token", func(t *testing.T) {
		req := &resourcepb.ListRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Group:     gr.Group,
					Resource:  gr.Resource,
					Namespace: "default",
				},
			},
			Limit:         1,
			NextPageToken: "start:1", // Skip first item
		}

		var results []v0alpha1.ResourcePermission
		listRV, err := backend.ListIterator(context.Background(), req, func(it resource.ListIterator) error {
			for it.Next() {
				var perm v0alpha1.ResourcePermission
				err := json.Unmarshal(it.Value(), &perm)
				require.NoError(t, err)
				results = append(results, perm)

				// Test continue token
				require.NotEmpty(t, it.ContinueToken())
			}
			return it.Error()
		})

		require.NoError(t, err)
		require.Equal(t, updated.UnixMilli(), listRV) // Only fold1
		require.Len(t, results, 1)
		require.Equal(t, "folder.grafana.app-folders-fold1", results[0].Name)
	})

	t.Run("Should use default limit when not specified", func(t *testing.T) {
		req := &resourcepb.ListRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Group:     gr.Group,
					Resource:  gr.Resource,
					Namespace: "default",
				},
			},
			// No limit specified, should default to 50
		}

		callbackCalled := false
		listRV, err := backend.ListIterator(context.Background(), req, func(it resource.ListIterator) error {
			callbackCalled = true
			// Just verify the iterator works
			for it.Next() {
				require.NotNil(t, it.Value())
			}
			return it.Error()
		})

		require.NoError(t, err)
		require.True(t, callbackCalled)
		require.Equal(t, updated.UnixMilli(), listRV)
	})

	t.Run("Should return empty results for org with no permissions", func(t *testing.T) {
		req := &resourcepb.ListRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Group:     gr.Group,
					Resource:  gr.Resource,
					Namespace: "org-999", // Non-existent org
				},
			},
			Limit: 10,
		}

		var results []v0alpha1.ResourcePermission
		listRV, err := backend.ListIterator(context.Background(), req, func(it resource.ListIterator) error {
			for it.Next() {
				var perm v0alpha1.ResourcePermission
				err := json.Unmarshal(it.Value(), &perm)
				require.NoError(t, err)
				results = append(results, perm)
			}
			return it.Error()
		})

		require.NoError(t, err)
		require.Equal(t, listRV, now.UnixMilli())
		require.Empty(t, results)
	})

	t.Run("Should propagate callback errors", func(t *testing.T) {
		req := &resourcepb.ListRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Group:     gr.Group,
					Resource:  gr.Resource,
					Namespace: "default",
				},
			},
			Limit: 10,
		}

		expectedErr := errors.New("callback error")
		listRV, err := backend.ListIterator(context.Background(), req, func(it resource.ListIterator) error {
			return expectedErr
		})

		require.Error(t, err)
		require.Equal(t, expectedErr, err)
		require.Zero(t, listRV)
	})

	t.Run("Should paginate through all results", func(t *testing.T) {
		expectedResults := []string{
			"dashboard.grafana.app-dashboards-dash1",
			"folder.grafana.app-folders-fold1",
		}
		req := &resourcepb.ListRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Group:     gr.Group,
					Resource:  gr.Resource,
					Namespace: "default",
				},
			},
			Limit:         1,
			NextPageToken: "start:0",
		}

		var perm v0alpha1.ResourcePermission
		continueToken := "start:0"
		results := []string{}
		_, _ = backend.ListIterator(context.Background(), req, func(it resource.ListIterator) error {
			for it.Next() {
				continueToken = it.ContinueToken()
				require.NoError(t, json.Unmarshal(it.Value(), &perm))
				results = append(results, perm.Name)
			}
			return nil
		})
		require.Equal(t, "start:1", continueToken)

		req.NextPageToken = continueToken
		_, _ = backend.ListIterator(context.Background(), req, func(it resource.ListIterator) error {
			for it.Next() {
				continueToken = it.ContinueToken()
				require.NoError(t, json.Unmarshal(it.Value(), &perm))
				results = append(results, perm.Name)
			}
			return nil
		})
		require.Equal(t, "start:2", continueToken)

		// No more results, token should not change
		req.NextPageToken = continueToken
		_, _ = backend.ListIterator(context.Background(), req, func(it resource.ListIterator) error {
			for it.Next() {
				continueToken = it.ContinueToken()
				require.NoError(t, json.Unmarshal(it.Value(), &perm))
				results = append(results, perm.Name)
			}
			return nil
		})
		require.Equal(t, "start:2", continueToken) // No change

		// Verify we got all expected results
		require.Len(t, results, 2)
		require.ElementsMatch(t, expectedResults, results)
	})
}

func TestIntegration_WriteEvent_Delete(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	backend := setupBackend(t)
	sql, err := backend.dbProvider(context.Background())
	require.NoError(t, err)
	setupTestRoles(t, sql.DB)

	updated1 := time.Date(2025, 9, 2, 0, 0, 0, 0, time.UTC)
	updated2 := time.Date(2025, 9, 3, 0, 0, 0, 0, time.UTC) // managed role for team 1 has a later updated permission

	gr := v0alpha1.ResourcePermissionInfo.GroupResource()

	t.Run("Should error if namespace is invalid", func(t *testing.T) {
		rv, err := backend.WriteEvent(context.Background(), resource.WriteEvent{
			Key:  &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Name: "folder.grafana.app-folders-fold1", Namespace: "invalid"},
			Type: resourcepb.WatchEvent_DELETED,
		})

		require.Zero(t, rv)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), "requires a valid namespace")
	})

	t.Run("Should fail to delete resource permissions if resource name is not specified", func(t *testing.T) {
		_, err = backend.WriteEvent(context.Background(), resource.WriteEvent{
			Key:  &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Name: "", Namespace: "default"},
			Type: resourcepb.WatchEvent_DELETED,
		})
		require.NotNil(t, err)
		require.Contains(t, err.Error(), "invalid key")
	})

	t.Run("Should fail to delete resource permissions for unknown resource", func(t *testing.T) {
		_, err = backend.WriteEvent(context.Background(), resource.WriteEvent{
			Key:  &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Name: "unknown.grafana.app-unknown-uid", Namespace: "default"},
			Type: resourcepb.WatchEvent_DELETED,
		})
		require.NotNil(t, err)
		require.Contains(t, err.Error(), "unknown group/resource")
	})

	t.Run("Should successfully delete fold1 permissions in org-1", func(t *testing.T) {
		// Check that permissions exist
		resp := backend.ReadResource(context.Background(), &resourcepb.ReadRequest{
			Key: &resourcepb.ResourceKey{Name: "folder.grafana.app-folders-fold1", Namespace: "default"},
		})

		require.NotNil(t, resp)
		require.Nil(t, resp.Error)
		require.NotNil(t, resp.Value)

		var permission v0alpha1.ResourcePermission
		err := json.Unmarshal(resp.Value, &permission)
		require.NoError(t, err)
		require.Len(t, permission.Spec.Permissions, 1)

		_, err = backend.WriteEvent(context.Background(), resource.WriteEvent{
			Key:  &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Name: "folder.grafana.app-folders-fold1", Namespace: "default"},
			Type: resourcepb.WatchEvent_DELETED,
		})
		require.Nil(t, err)

		// Check that permissions are deleted
		resp = backend.ReadResource(context.Background(), &resourcepb.ReadRequest{
			Key: &resourcepb.ResourceKey{Name: "folder.grafana.app-folders-fold1", Namespace: "default"},
		})
		require.NotNil(t, resp.Error)

		// Check that org-2 permissions are unaffected
		resp = backend.ReadResource(context.Background(), &resourcepb.ReadRequest{
			Key: &resourcepb.ResourceKey{Name: "folder.grafana.app-folders-fold1", Namespace: "org-2"},
		})
		require.NotNil(t, resp)
		require.Nil(t, resp.Error)
		require.NotNil(t, resp.Value)
		require.Equal(t, updated1.UnixMilli(), resp.ResourceVersion)
		err = json.Unmarshal(resp.Value, &permission)
		require.NoError(t, err)
		require.Len(t, permission.Spec.Permissions, 1)

		// Check that dash1 permissions in org 1 are unaffected
		resp = backend.ReadResource(context.Background(), &resourcepb.ReadRequest{
			Key: &resourcepb.ResourceKey{Name: "dashboard.grafana.app-dashboards-dash1", Namespace: "default"},
		})
		require.NotNil(t, resp)
		require.Nil(t, resp.Error)
		require.NotNil(t, resp.Value)
		require.Equal(t, updated2.UnixMilli(), resp.ResourceVersion)
		err = json.Unmarshal(resp.Value, &permission)
		require.NoError(t, err)
		require.Len(t, permission.Spec.Permissions, 4)
	})
}

func TestWriteEvent_Modify(t *testing.T) {
	store := db.InitTestDB(t)

	timeNow = func() time.Time {
		return time.Date(2025, 8, 28, 17, 13, 0, 0, time.UTC)
	}

	sqlHelper := &legacysql.LegacyDatabaseHelper{
		DB:    store,
		Table: func(name string) string { return name },
	}

	dbProvider := func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return sqlHelper, nil
	}

	t.Run("should error with invalid namespace", func(t *testing.T) {
		backend := ProvideStorageBackend(dbProvider)

		rv, err := backend.WriteEvent(context.Background(), resource.WriteEvent{
			Type: resourcepb.WatchEvent_MODIFIED,
			Key:  &resourcepb.ResourceKey{Name: "folder.grafana.app-folders-fold1", Namespace: "invalid"},
		})

		require.Zero(t, rv)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), "requires a valid namespace")
	})

	t.Run("should error if there are no permission specified in the body", func(t *testing.T) {
		backend := ProvideStorageBackend(dbProvider)

		resourcePerm, err := utils.MetaAccessor(&v0alpha1.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "folder.grafana.app-folders-fold1",
				Namespace: "default",
			},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource: v0alpha1.ResourcePermissionspecResource{
					ApiGroup: "folder.grafana.app",
					Resource: "folders",
					Name:     "fold1",
				},
			},
		})
		require.NoError(t, err)

		gr := v0alpha1.ResourcePermissionInfo.GroupResource()
		rv, err := backend.WriteEvent(context.Background(), resource.WriteEvent{
			Type:   resourcepb.WatchEvent_MODIFIED,
			Key:    &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Name: "folder.grafana.app-folders-fold1", Namespace: "default"},
			Object: resourcePerm,
		})
		require.Zero(t, rv)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), errInvalidSpec.Error())
	})

	t.Run("should error if name and spec do not match", func(t *testing.T) {
		backend := ProvideStorageBackend(dbProvider)

		resourcePerm, err := utils.MetaAccessor(&v0alpha1.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "folder.grafana.app-folders-fold1",
				Namespace: "default",
			},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource: v0alpha1.ResourcePermissionspecResource{
					ApiGroup: "folder.grafana.app",
					Resource: "folders",
					Name:     "fold2",
				},
				Permissions: []v0alpha1.ResourcePermissionspecPermission{
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
						Name: "Viewer",
						Verb: "Admin",
					},
				},
			},
		})
		require.NoError(t, err)

		gr := v0alpha1.ResourcePermissionInfo.GroupResource()
		rv, err := backend.WriteEvent(context.Background(), resource.WriteEvent{
			Type:   resourcepb.WatchEvent_MODIFIED,
			Key:    &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Name: "folder.grafana.app-folders-fold1", Namespace: "default"},
			Object: resourcePerm,
		})
		require.Zero(t, rv)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), errInvalidSpec.Error())
	})

	t.Run("should error if resource name is empty", func(t *testing.T) {
		backend := ProvideStorageBackend(dbProvider)

		resourcePerm, err := utils.MetaAccessor(&v0alpha1.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "folder.grafana.app-folders-",
				Namespace: "default",
			},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource: v0alpha1.ResourcePermissionspecResource{
					ApiGroup: "folder.grafana.app",
					Resource: "folders",
					Name:     "",
				},
				Permissions: []v0alpha1.ResourcePermissionspecPermission{
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
						Name: "Viewer",
						Verb: "Admin",
					},
				},
			},
		})
		require.NoError(t, err)

		gr := v0alpha1.ResourcePermissionInfo.GroupResource()
		rv, err := backend.WriteEvent(context.Background(), resource.WriteEvent{
			Type:   resourcepb.WatchEvent_MODIFIED,
			Key:    &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Name: "folder.grafana.app-folders-", Namespace: "default"},
			Object: resourcePerm,
		})
		require.Zero(t, rv)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), errInvalidName.Error())
	})

	t.Run("should error if the resource is unknown", func(t *testing.T) {
		backend := ProvideStorageBackend(dbProvider)

		resourcePerm, err := utils.MetaAccessor(&v0alpha1.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "unknown.grafana.app-unknown-ukn1",
				Namespace: "default",
			},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource: v0alpha1.ResourcePermissionspecResource{
					ApiGroup: "unknown.grafana.app",
					Resource: "unknown",
					Name:     "ukn1",
				},
				Permissions: []v0alpha1.ResourcePermissionspecPermission{
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
						Name: "Viewer",
						Verb: "Admin",
					},
				},
			},
		})
		require.NoError(t, err)

		gr := v0alpha1.ResourcePermissionInfo.GroupResource()
		rv, err := backend.WriteEvent(context.Background(), resource.WriteEvent{
			Type:   resourcepb.WatchEvent_MODIFIED,
			Key:    &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Name: "unknown.grafana.app-unknown-ukn1", Namespace: "default"},
			Object: resourcePerm,
		})
		require.Zero(t, rv)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), errUnknownGroupResource.Error())
	})

	t.Run("should work with valid resource permission", func(t *testing.T) {
		backend := ProvideStorageBackend(dbProvider)
		backend.identityStore = NewFakeIdentityStore(t)

		resourcePerm, err := utils.MetaAccessor(&v0alpha1.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "folder.grafana.app-folders-fold1",
				Namespace: "default",
			},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource: v0alpha1.ResourcePermissionspecResource{
					ApiGroup: "folder.grafana.app",
					Resource: "folders",
					Name:     "fold1",
				},
				Permissions: []v0alpha1.ResourcePermissionspecPermission{
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
						Name: "Viewer",
						Verb: "Admin",
					},
				},
			},
		})
		require.NoError(t, err)

		// Create resource first
		gr := v0alpha1.ResourcePermissionInfo.GroupResource()
		rv, err := backend.WriteEvent(context.Background(), resource.WriteEvent{
			Type:   resourcepb.WatchEvent_ADDED,
			Key:    &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Name: "folder.grafana.app-folders-fold1", Namespace: "default"},
			Object: resourcePerm,
		})

		require.NoError(t, err)
		require.Equal(t, timeNow().UnixMilli(), rv)

		// Modify resource
		resourcePerm, err = utils.MetaAccessor(&v0alpha1.ResourcePermission{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "folder.grafana.app-folders-fold1",
				Namespace: "default",
			},
			Spec: v0alpha1.ResourcePermissionSpec{
				Resource: v0alpha1.ResourcePermissionspecResource{
					ApiGroup: "folder.grafana.app",
					Resource: "folders",
					Name:     "fold1",
				},
				Permissions: []v0alpha1.ResourcePermissionspecPermission{
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
						Name: "Viewer",
						Verb: "Edit",
					},
				},
			},
		})
		require.NoError(t, err)

		rv, err = backend.WriteEvent(context.Background(), resource.WriteEvent{
			Type:   resourcepb.WatchEvent_MODIFIED,
			Key:    &resourcepb.ResourceKey{Group: gr.Group, Resource: gr.Resource, Name: "folder.grafana.app-folders-fold1", Namespace: "default"},
			Object: resourcePerm,
		})

		require.NoError(t, err)
		require.Equal(t, timeNow().UnixMilli(), rv)
	})
}

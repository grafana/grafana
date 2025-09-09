package resourcepermission

import (
	"context"
	"encoding/json"
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

func TestWriteEvent_Delete(t *testing.T) {
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

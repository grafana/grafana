package resourcepermission

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestResourcePermSqlBackend_ReadResource(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	backend := setupBackend(t)
	sql, err := backend.dbProvider(context.Background())
	require.NoError(t, err)
	setupTestRoles(t, sql.DB)

	created := time.Date(2025, 9, 2, 0, 0, 0, 0, time.UTC)

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
		require.Equal(t, created.UnixMilli(), resp.ResourceVersion)

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
		require.Equal(t, created.UnixMilli(), resp.ResourceVersion)

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
		require.Equal(t, created.UnixMilli(), resp.ResourceVersion)

		var permission v0alpha1.ResourcePermission
		err := json.Unmarshal(resp.Value, &permission)
		require.NoError(t, err)
		require.Equal(t, "dashboard.grafana.app-dashboards-dash1", permission.Name)
		require.Len(t, permission.Spec.Permissions, 4)

		require.Equal(t, "user-1", permission.Spec.Permissions[0].Name)
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindUser, permission.Spec.Permissions[0].Kind)
		require.Equal(t, "edit", permission.Spec.Permissions[0].Verb)

		require.Equal(t, "sa-1", permission.Spec.Permissions[1].Name)
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount, permission.Spec.Permissions[1].Kind)
		require.Equal(t, "view", permission.Spec.Permissions[1].Verb)

		require.Equal(t, "Editor", permission.Spec.Permissions[2].Name)
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindBasicRole, permission.Spec.Permissions[2].Kind)
		require.Equal(t, "edit", permission.Spec.Permissions[2].Verb)

		require.Equal(t, "team-1", permission.Spec.Permissions[3].Name)
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindTeam, permission.Spec.Permissions[3].Kind)
		require.Equal(t, "admin", permission.Spec.Permissions[3].Verb)
	})
}

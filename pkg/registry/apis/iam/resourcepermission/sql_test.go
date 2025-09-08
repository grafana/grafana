package resourcepermission

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

var (
	created = time.Date(2025, 9, 2, 0, 0, 0, 0, time.UTC)
	updated = time.Date(2025, 9, 3, 0, 0, 0, 0, time.UTC) // The "dashboards:admin" permission was updated later

	fold1ResourcePermission = v0alpha1.ResourcePermission{
		ObjectMeta: metav1.ObjectMeta{
			Name:              "folder.grafana.app-folders-fold1",
			CreationTimestamp: metav1.Time{Time: created},
			ResourceVersion:   fmt.Sprint(created.UnixMilli()),
		},
		TypeMeta: metav1.TypeMeta{
			Kind:       "ResourcePermission",
			APIVersion: "iam.grafana.app/v0alpha1",
		},
		Spec: v0alpha1.ResourcePermissionSpec{
			Resource: v0alpha1.ResourcePermissionspecResource{
				ApiGroup: "folder.grafana.app",
				Resource: "folders",
				Name:     "fold1",
			},
			Permissions: []v0alpha1.ResourcePermissionspecPermission{
				{
					Kind: v0alpha1.ResourcePermissionSpecPermissionKindUser,
					Name: "user-1",
					Verb: "view",
				},
			},
		},
	}
	dash1ResourcePermission = v0alpha1.ResourcePermission{
		ObjectMeta: metav1.ObjectMeta{
			Name:              "dashboard.grafana.app-dashboards-dash1",
			CreationTimestamp: metav1.Time{Time: created},
			ResourceVersion:   fmt.Sprint(updated.UnixMilli()),
		},
		TypeMeta: metav1.TypeMeta{
			Kind:       "ResourcePermission",
			APIVersion: "iam.grafana.app/v0alpha1",
		},
		Spec: v0alpha1.ResourcePermissionSpec{
			Resource: v0alpha1.ResourcePermissionspecResource{
				ApiGroup: "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "dash1",
			},
			Permissions: []v0alpha1.ResourcePermissionspecPermission{
				{
					Kind: v0alpha1.ResourcePermissionSpecPermissionKindBasicRole,
					Name: "Editor",
					Verb: "edit",
				},
				{
					Kind: v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount,
					Name: "sa-1",
					Verb: "view",
				},
				{
					Kind: v0alpha1.ResourcePermissionSpecPermissionKindTeam,
					Name: "team-1",
					Verb: "admin",
				},
				{
					Kind: v0alpha1.ResourcePermissionSpecPermissionKindUser,
					Name: "user-1",
					Verb: "edit",
				},
			},
		},
	}
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func setupBackend(t *testing.T) *ResourcePermSqlBackend {
	store := db.InitTestDB(t)

	sqlHelper := &legacysql.LegacyDatabaseHelper{
		DB:    store,
		Table: func(name string) string { return name },
	}

	dbProvider := func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return sqlHelper, nil
	}

	return ProvideStorageBackend(dbProvider)
}

func setupTestRoles(t *testing.T, store db.DB) {
	sess := store.GetSqlxSession()

	_, err := sess.Exec(context.Background(),
		`INSERT INTO role (id, version, org_id, uid, name, display_name, description, group_name, hidden, created, updated)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
		(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		// Managed roles
		1, 0, 1, "managed_users_1_permissions_org1", "managed:users:1:permissions", "", "", "", false, "2025-09-02", "2025-09-02", // Org-1 - User 1
		2, 0, 2, "managed_users_2_permissions_org2", "managed:users:2:permissions", "", "", "", false, "2025-09-02", "2025-09-02", // Org-2 - User 2
		3, 0, 1, "managed_users_3_permissions_org1", "managed:users:3:permissions", "", "", "", false, "2025-09-02", "2025-09-02", // Org-1 - Service Account
		4, 0, 1, "managed_builtins_editor_permissions_org1", "managed:builtins:editor:permissions", "", "", "", false, "2025-09-02", "2025-09-02", // Org-1 - Builtin Editor
		5, 0, 1, "managed_teams_1_permissions_org1", "managed:teams:1:permissions", "", "", "", false, "2025-09-02", "2025-09-02", // Org-1 - Team 1
	)
	require.NoError(t, err)

	// Permissions
	_, err = sess.Exec(context.Background(),
		`INSERT INTO permission (role_id, action, scope, created, updated)
		VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
		// Permissions for managed:users:1:permissions
		1, "folders:view", "folders:uid:fold1", "2025-09-02", "2025-09-02",
		1, "dashboards:edit", "dashboards:uid:dash1", "2025-09-02", "2025-09-02",
		// Permissions for managed:users:2:permissions
		2, "folders:edit", "folders:uid:fold1", "2025-09-02", "2025-09-02",
		// Permissions for managed:users:3:permissions (service account)
		3, "dashboards:view", "dashboards:uid:dash1", "2025-09-02", "2025-09-02",
		// Permissions for managed:builtins:editor:permissions
		4, "dashboards:edit", "dashboards:uid:dash1", "2025-09-02", "2025-09-02",
		// Permissions for managed:teams:1:permissions
		5, "dashboards:admin", "dashboards:uid:dash1", "2025-09-02", "2025-09-03", // Recently updated
	)
	require.NoError(t, err)

	_, err = sess.Exec(context.Background(),
		`INSERT INTO`+store.GetDialect().Quote("user")+`(id, org_id, uid, login, email, is_admin, is_service_account, created, updated, version)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		// Users
		1, 1, "user-1", "user-1", "user-1@example.com", false, false, "2025-09-02 00:00:00", "2025-09-02 00:00:00", 0,
		2, 1, "user-2", "user-2", "user-2@example.com", false, false, "2025-09-02 00:00:00", "2025-09-02 00:00:00", 0,
		3, 1, "sa-1", "sa-1", "", false, true, "2025-09-02 00:00:00", "2025-09-02 00:00:00", 0,
	)
	require.NoError(t, err)

	_, err = sess.Exec(context.Background(),
		`INSERT INTO team (id, org_id, uid, name, created, updated)
	VALUES (?, ?, ?, ?, ?, ?)`,
		// Teams
		1, 1, "team-1", "team-1", "2025-09-02 00:00:00", "2025-09-02 00:00:00",
	)
	require.NoError(t, err)

	// User role bindings
	_, err = sess.Exec(context.Background(),
		`INSERT INTO user_role (org_id, user_id, role_id, created)
	VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)`,
		1, 1, 1, "2025-09-02 00:00:00", // User-1 -> managed:users:1:permissions
		2, 2, 2, "2025-09-02 00:00:00", // User-2 -> managed:users:2:permissions
		1, 3, 3, "2025-09-02 00:00:00", // ServiceAccount -> managed:users:3:permissions
	)
	require.NoError(t, err)

	// Team role bindings
	_, err = sess.Exec(context.Background(),
		`INSERT INTO team_role (org_id, team_id, role_id, created)
	VALUES (?, ?, ?, ?)`,
		1, 1, 5, "2025-09-02 00:00:00", // Team-1 -> managed:teams:1:permissions
	)
	require.NoError(t, err)

	// basic role bindings
	_, err = sess.Exec(context.Background(),
		`INSERT INTO builtin_role (org_id, role, role_id, created, updated)
	VALUES (?, ?, ?, ?, ?)`,
		1, "Editor", 4, "2025-09-02 00:00:00", "2025-09-02 00:00:00", // Builtin Editor -> managed:builtins:editor:permissions
	)
	require.NoError(t, err)
}

func TestIntegration_ResourcePermSqlBackend_newRoleIterator(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	backend := setupBackend(t)
	sql, err := backend.dbProvider(context.Background())
	require.NoError(t, err)
	setupTestRoles(t, sql.DB)

	tests := []struct {
		name       string
		orgID      int64
		pagination common.Pagination
		want       []v0alpha1.ResourcePermission
		err        error
	}{
		{
			name:  "should return all permissions for org-1",
			orgID: 1,
			pagination: common.Pagination{
				Limit: 100,
			},
			want: []v0alpha1.ResourcePermission{dash1ResourcePermission, fold1ResourcePermission},
			err:  nil,
		},
		{
			name:  "should return a partial list of permissions for org-1",
			orgID: 1,
			pagination: common.Pagination{
				Continue: 1,
				Limit:    1,
			},
			want: []v0alpha1.ResourcePermission{fold1ResourcePermission},
			err:  nil,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ns := types.NamespaceInfo{OrgID: tt.orgID}
			it, err := backend.newRoleIterator(context.Background(), sql, ns, &tt.pagination)
			require.NoError(t, err)
			var result []v0alpha1.ResourcePermission
			for it.Next() {
				result = append(result, *it.cur())
			}
			require.NoError(t, it.Error())
			for i := range result {
				require.Equal(t, tt.want[i].Name, result[i].Name)
				require.Equal(t, tt.want[i].CreationTimestamp, result[i].CreationTimestamp)
				require.Equal(t, tt.want[i].ResourceVersion, result[i].ResourceVersion)
				require.NotZero(t, result[i].GetUpdateTimestamp())
				require.Equal(t, tt.want[i].TypeMeta, result[i].TypeMeta)
				for j := range result[i].Spec.Permissions {
					require.Equal(t, tt.want[i].Spec.Permissions[j], result[i].Spec.Permissions[j])
				}
				require.Equal(t, tt.want[i].Spec.Resource, result[i].Spec.Resource)
			}
		})
	}
}

func TestIntegration_ResourcePermSqlBackend_getResourcePermission(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	backend := setupBackend(t)
	sql, err := backend.dbProvider(context.Background())
	require.NoError(t, err)
	setupTestRoles(t, sql.DB)

	tests := []struct {
		name     string
		resource string
		orgID    int64
		want     v0alpha1.ResourcePermission
		err      error
	}{
		{
			name:     "should return only org-1 permissions for fold1",
			resource: "folder.grafana.app-folders-fold1",
			orgID:    1,
			want:     fold1ResourcePermission,
			err:      nil,
		},
		{
			name:     "should return empty for org-2",
			orgID:    2,
			resource: "dashboard.grafana.app-dashboards-dash1",
			err:      errNotFound,
		},
		{
			name:     "should return an error for unknown resource type",
			orgID:    1,
			resource: "unknown.grafana.app-unknown-u1",
			err:      errUnknownGroupResource,
		},
		{
			name:     "should return an error for invalid resource name",
			orgID:    1,
			resource: "invalid.grafana.app-invalid",
			err:      errInvalidName,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ns := types.NamespaceInfo{
				OrgID: tt.orgID,
			}
			got, err := backend.getResourcePermission(context.Background(), sql, ns, tt.resource)
			if tt.err != nil {
				require.Error(t, err)
				require.ErrorIs(t, err, tt.err)
				return
			}
			require.NoError(t, err)

			require.Equal(t, tt.want.Name, got.Name)
			require.Equal(t, tt.want.CreationTimestamp, got.CreationTimestamp)
			require.Equal(t, tt.want.ResourceVersion, got.ResourceVersion)
			require.NotZero(t, got.GetUpdateTimestamp())
			require.Equal(t, tt.want.TypeMeta, got.TypeMeta)
			require.Equal(t, tt.want.Spec, got.Spec)
		})
	}
}

func TestResourcePermSqlBackend_deleteResourcePermission(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	backend := setupBackend(t)
	sql, err := backend.dbProvider(context.Background())
	require.NoError(t, err)
	setupTestRoles(t, sql.DB)

	tests := []struct {
		name     string
		resource string
		orgID    int64
		want     v0alpha1.ResourcePermission
		err      error
	}{
		{
			name:     "should return an error for unknown resource type",
			orgID:    1,
			resource: "unknown.grafana.app-unknown-u1",
			err:      errUnknownGroupResource,
		},
		{
			name:     "should return an error for invalid resource name",
			orgID:    1,
			resource: "invalid.grafana.app-invalid",
			err:      errInvalidName,
		},
		{
			name:     "should delete permissions in org1 for fold1",
			resource: "folder.grafana.app-folders-fold1",
			orgID:    1,
			err:      nil,
		},
		{
			name:     "should delete permissions in org2 for fold1",
			resource: "folder.grafana.app-folders-fold1",
			orgID:    2,
			err:      nil,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ns := types.NamespaceInfo{
				OrgID: tt.orgID,
			}
			err := backend.deleteResourcePermission(context.Background(), sql, ns, tt.resource)
			if tt.err != nil {
				require.Error(t, err)
				require.ErrorIs(t, err, tt.err)
				return
			}
			require.NoError(t, err)

			// check that the resource has been deleted
			_, err = backend.getResourcePermission(context.Background(), sql, ns, tt.resource)
			require.Error(t, err)
		})
	}
}

func TestIntegration_ResourcePermSqlBackend_CreateResourcePermission(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	store := db.InitTestDB(t)

	timeNow = func() time.Time {
		return time.Date(2025, 8, 28, 17, 13, 0, 0, time.UTC)
	}

	t.Run("should create resource permission", func(t *testing.T) {
		resourcePerm := &v0alpha1.ResourcePermission{
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
						Verb: "admin",
					},
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindUser,
						Name: "captain",
						Verb: "edit",
					},
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount,
						Name: "robot",
						Verb: "view",
					},
					{
						Kind: v0alpha1.ResourcePermissionSpecPermissionKindTeam,
						Name: "devs",
						Verb: "admin",
					},
				},
			},
		}

		ctx := context.Background()
		backend := setupBackend(t)
		sqlHelper, _ := backend.dbProvider(ctx)
		backend.identityStore = NewFakeIdentityStore(t)

		mapper, grn, err := backend.splitResourceName(resourcePerm.Name)
		require.NoError(t, err)

		rv, err := backend.createResourcePermission(ctx, sqlHelper, types.NamespaceInfo{Value: "default", OrgID: 1}, mapper, grn, resourcePerm)
		require.NoError(t, err)
		require.Equal(t, timeNow().UnixMilli(), rv)

		var (
			assigned   int
			roleID     int64
			permission accesscontrol.Permission
			sess       = store.GetSqlxSession()
		)

		// Check that the roles were created and assigned
		err = sess.Get(ctx, &roleID, "SELECT id FROM role WHERE org_id = ? AND name = ?", 1, "managed:users:101:permissions")
		require.NoError(t, err)
		require.NotZero(t, roleID)
		err = sess.Get(ctx, &assigned, "SELECT 1 FROM user_role WHERE org_id = ? AND role_id = ? AND user_id = ?", 1, roleID, "101")
		require.NoError(t, err)
		require.Equal(t, 1, assigned)
		err = sess.Get(ctx, &permission, "SELECT action, scope FROM permission WHERE role_id = ?", roleID)
		require.NoError(t, err)
		require.Equal(t, "folders:uid:fold1", permission.Scope)
		require.Equal(t, "folders:edit", permission.Action)

		err = sess.Get(ctx, &roleID, "SELECT id FROM role WHERE org_id = ? AND name = ?", 1, "managed:users:201:permissions")
		require.NoError(t, err)
		require.NotZero(t, roleID)
		err = sess.Get(ctx, &assigned, "SELECT 1 FROM user_role WHERE org_id = ? AND role_id = ? AND user_id = ?", 1, roleID, "201")
		require.NoError(t, err)
		require.Equal(t, 1, assigned)
		err = sess.Get(ctx, &permission, "SELECT action, scope FROM permission WHERE role_id = ?", roleID)
		require.NoError(t, err)
		require.Equal(t, "folders:uid:fold1", permission.Scope)
		require.Equal(t, "folders:view", permission.Action)

		err = sess.Get(ctx, &roleID, "SELECT id FROM role WHERE org_id = ? AND name = ?", 1, "managed:teams:301:permissions")
		require.NoError(t, err)
		require.NotZero(t, roleID)
		err = sess.Get(ctx, &assigned, "SELECT 1 FROM team_role WHERE org_id = ? AND role_id = ? AND team_id = ?", 1, roleID, "301")
		require.NoError(t, err)
		require.Equal(t, 1, assigned)
		err = sess.Get(ctx, &permission, "SELECT action, scope FROM permission WHERE role_id = ?", roleID)
		require.NoError(t, err)
		require.Equal(t, "folders:uid:fold1", permission.Scope)
		require.Equal(t, "folders:admin", permission.Action)

		err = sess.Get(ctx, &roleID, "SELECT id FROM role WHERE org_id = ? AND name = ?", 1, "managed:builtins:viewer:permissions")
		require.NoError(t, err)
		require.NotZero(t, roleID)
		err = sess.Get(ctx, &assigned, "SELECT 1 FROM builtin_role WHERE org_id = ? AND role = ?", 1, "Viewer")
		require.NoError(t, err)
		require.Equal(t, 1, assigned)
		err = sess.Get(ctx, &permission, "SELECT action, scope FROM permission WHERE role_id = ?", roleID)
		require.NoError(t, err)
		require.Equal(t, "folders:uid:fold1", permission.Scope)
		require.Equal(t, "folders:admin", permission.Action)
	})
}

type fakeIdentityStore struct {
	t *testing.T

	users           map[string]int64
	serviceAccounts map[string]int64
	teams           map[string]int64
	expectedNs      types.NamespaceInfo
}

func NewFakeIdentityStore(t *testing.T) *fakeIdentityStore {
	return &fakeIdentityStore{
		t:               t,
		users:           map[string]int64{"captain": 101},
		serviceAccounts: map[string]int64{"robot": 201},
		teams:           map[string]int64{"devs": 301},
		expectedNs:      types.NamespaceInfo{Value: "default"},
	}
}

// GetServiceAccountInternalID implements legacy.LegacyIdentityStore.
func (f *fakeIdentityStore) GetServiceAccountInternalID(ctx context.Context, ns types.NamespaceInfo, query legacy.GetServiceAccountInternalIDQuery) (*legacy.GetServiceAccountInternalIDResult, error) {
	require.Equal(f.t, f.expectedNs.Value, ns.Value)

	id, ok := f.serviceAccounts[query.UID]
	if !ok {
		return nil, errors.New("not found")
	}
	return &legacy.GetServiceAccountInternalIDResult{ID: id}, nil
}

// GetTeamInternalID implements legacy.LegacyIdentityStore.
func (f *fakeIdentityStore) GetTeamInternalID(ctx context.Context, ns types.NamespaceInfo, query legacy.GetTeamInternalIDQuery) (*legacy.GetTeamInternalIDResult, error) {
	require.Equal(f.t, f.expectedNs.Value, ns.Value)

	id, ok := f.teams[query.UID]
	if !ok {
		return nil, errors.New("not found")
	}
	return &legacy.GetTeamInternalIDResult{ID: id}, nil
}

// GetUserInternalID implements legacy.LegacyIdentityStore.
func (f *fakeIdentityStore) GetUserInternalID(ctx context.Context, ns types.NamespaceInfo, query legacy.GetUserInternalIDQuery) (*legacy.GetUserInternalIDResult, error) {
	require.Equal(f.t, f.expectedNs.Value, ns.Value)

	id, ok := f.users[query.UID]
	if !ok {
		return nil, errors.New("not found")
	}
	return &legacy.GetUserInternalIDResult{ID: id}, nil
}

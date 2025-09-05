package resourcepermission

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/require"
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

func TestResourcePermSqlBackend_getResourcePermission(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	backend := setupBackend(t)
	sql, err := backend.dbProvider(context.Background())
	require.NoError(t, err)
	setupTestRoles(t, sql.DB)

	created := time.Date(2025, 9, 2, 0, 0, 0, 0, time.UTC)

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
			want: v0alpha1.ResourcePermission{
				ObjectMeta: metaV1.ObjectMeta{
					Name:              "folder.grafana.app-folders-fold1",
					CreationTimestamp: metaV1.Time{Time: created},
					ResourceVersion:   fmt.Sprint(created.UnixMilli()),
				},
				TypeMeta: v0alpha1.ResourcePermissionInfo.TypeMeta(),
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
			},
			err: nil,
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

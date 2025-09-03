package resourcepermission

import (
	"context"
	"testing"
	"time"

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
		VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
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
		5, "dashboards:admin", "dashboards:uid:dash1", "2025-09-02", "2025-09-02",
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
		1, 2, 2, "2025-09-02 00:00:00", // User-2 -> managed:users:2:permissions
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
		name  string
		query *ListResourcePermissionsQuery
		want  map[groupResourceName][]flatResourcePermission
		err   error
	}{
		{
			name: "list fold1 permissions",
			query: &ListResourcePermissionsQuery{
				OrgID:      1,
				Scope:      "folders:uid:fold1",
				ActionSets: []string{"folders:admin", "folders:edit", "folders:view"},
			},
			want: map[groupResourceName][]flatResourcePermission{
				{Group: "folder.grafana.app", Resource: "folders", Name: "fold1"}: {
					{
						ID:               1,
						Action:           "folders:view",
						Scope:            "folders:uid:fold1",
						Created:          created,
						Updated:          created,
						RoleName:         "managed:users:1:permissions",
						SubjectUID:       "user-1",
						SubjectType:      "user",
						IsServiceAccount: false,
					},
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := backend.getResourcePermissions(context.Background(), sql, tt.query)
			if tt.err != nil {
				require.Error(t, err)
				require.ErrorIs(t, err, tt.err)
				return
			}
			require.NoError(t, err)
			require.Len(t, got, len(tt.want))
			for grn, flatPermissions := range tt.want {
				require.ElementsMatch(t, flatPermissions, got[grn])
			}
		})
	}

}

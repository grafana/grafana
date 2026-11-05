package store

import (
	"context"
	"testing"
	"text/template"

	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIdentityQueries(t *testing.T) {
	// prefix tables with grafana
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "grafana." + n
		},
	}

	getIdentifiers := func(q *UserIdentifierQuery) sqltemplate.SQLTemplate {
		v := newGetUserIdentifiers(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	getBasicRoles := func(q *BasicRoleQuery) sqltemplate.SQLTemplate {
		v := newGetBasicRoles(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	getPermissions := func(q *PermissionsQuery, forcePermissionRoleActionIndex bool) sqltemplate.SQLTemplate {
		v := newGetPermissions(nodb, q, forcePermissionRoleActionIndex)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	getFolders := func(q *FolderQuery) sqltemplate.SQLTemplate {
		v := newGetFolders(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlReportUID: {
				{
					Name: "report_by_id",
					Data: &getReportUIDQuery{
						SQLTemplate: mocks.NewTestingSQLTemplate(),
						ReportTable: nodb.Table("report"),
						OrgID:       1,
						ReportID:    17,
					},
				},
			},
			sqlUserIdentifiers: {
				{
					Name: "id_specified",
					Data: getIdentifiers(&UserIdentifierQuery{
						UserID: 1,
					}),
				},
				{
					Name: "uid_specified",
					Data: getIdentifiers(&UserIdentifierQuery{
						UserUID: "some_uid",
					}),
				},
			},
			sqlQueryBasicRoles: {
				{
					Name: "basic_roles",
					Data: getBasicRoles(&BasicRoleQuery{
						UserID: 1,
						OrgID:  1,
					}),
				},
			},
			sqlUserHasPerms: {
				{
					Name: "permission_presence",
					Data: getPermissions(&PermissionsQuery{
						UserID: 1,
						OrgID:  1,
						Role:   "Viewer",
					}, false),
				},
				{
					Name: "with_action_sets",
					Data: getPermissions(&PermissionsQuery{
						UserID:        1,
						OrgID:         1,
						Role:          "Admin",
						IsServerAdmin: true,
						TeamIDs:       []int64{1, 2},
						Action:        "folders:create",
						ActionSets:    []string{"folders:edit", "folders:admin"},
					}, true),
				},
			},
			sqlUserPerms: {
				{
					Name: "viewer_user",
					Data: getPermissions(&PermissionsQuery{
						UserID: 1,
						OrgID:  1,
						Action: "folders:read",
						Role:   "Viewer",
					}, false),
				},
				{
					Name: "admin_user",
					Data: getPermissions(&PermissionsQuery{
						UserID:        1,
						OrgID:         1,
						Action:        "folders:read",
						Role:          "Admin",
						IsServerAdmin: true,
					}, false),
				},
				{
					Name: "user_with_teams",
					Data: getPermissions(&PermissionsQuery{
						UserID:  1,
						OrgID:   1,
						Action:  "folders:read",
						Role:    "None",
						TeamIDs: []int64{1, 2},
					}, false),
				},
				{
					Name: "anonymous_user",
					Data: getPermissions(&PermissionsQuery{
						OrgID:  1,
						Action: "folders:read",
						Role:   "Viewer",
					}, false),
				},
				{
					Name: "all_user_permissions",
					Data: getPermissions(&PermissionsQuery{
						UserID: 1,
						OrgID:  1,
						Role:   "Editor",
					}, false),
				},
				{
					Name: "With_action_sets",
					Data: getPermissions(&PermissionsQuery{
						UserID:     1,
						OrgID:      1,
						Action:     "folders:create",
						ActionSets: []string{"folders:edit", "folders:admin"},
						Role:       "Viewer",
					}, true),
				},
				{
					Name: "all_user_permissions_with_index_option_enabled",
					Data: getPermissions(&PermissionsQuery{
						UserID: 1,
						OrgID:  1,
						Role:   "Editor",
					}, true),
				},
			},
			sqlFolders: {
				{
					Name: "folder_query",
					Data: getFolders(&FolderQuery{
						OrgID: 1,
					}),
				},
			},
		},
	})
}

func TestIntegrationSQLPermissionStoreIndexOption(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	db := sqlstore.NewTestStore(t)
	session := db.GetSqlxSession()
	ctx := t.Context()

	_, err := session.Exec(ctx, `INSERT INTO builtin_role (role, role_id, created, updated, org_id)
		VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`, "Viewer", 1001, 1)
	require.NoError(t, err)

	for _, permission := range []struct {
		action string
		scope  string
	}{
		{action: "folders:read", scope: "folders:uid:one"},
		{action: "folders:create", scope: "folders:uid:two"},
		{action: "folders:edit", scope: "folders:uid:three"},
		{action: "dashboards:read", scope: "dashboards:uid:four"},
	} {
		_, err = session.Exec(ctx, `INSERT INTO permission (role_id, action, scope, created, updated, kind, attribute, identifier)
			VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?)`, 1001, permission.action, permission.scope, "resources", "uid", permission.scope)
		require.NoError(t, err)
	}

	for _, forceIndex := range []bool{false, true} {
		t.Run(map[bool]string{false: "disabled", true: "enabled"}[forceIndex], func(t *testing.T) {
			permissionStore := NewSQLPermissionStore(legacysql.NewDatabaseProvider(db), tracing.InitializeTracerForTest(), forceIndex)

			filtered, err := permissionStore.GetUserPermissions(ctx, types.NamespaceInfo{OrgID: 1}, PermissionsQuery{
				Role: "Viewer", Action: "folders:read",
			})
			require.NoError(t, err)
			require.Equal(t, []string{"folders:uid:one"}, permissionScopes(filtered))

			all, err := permissionStore.GetUserPermissions(ctx, types.NamespaceInfo{OrgID: 1}, PermissionsQuery{Role: "Viewer"})
			require.NoError(t, err)
			require.ElementsMatch(t, []string{"folders:uid:one", "folders:uid:two", "folders:uid:three", "dashboards:uid:four"}, permissionScopes(all))

			for _, tc := range []struct {
				name  string
				orgID int64
				query PermissionsQuery
				want  bool
			}{
				{
					name:  "has permissions",
					orgID: 1,
					query: PermissionsQuery{Role: "Viewer"},
					want:  true,
				},
				{
					name:  "different organization",
					orgID: 2,
					query: PermissionsQuery{Role: "Viewer"},
					want:  false,
				},
				{
					name:  "unassigned role",
					orgID: 1,
					query: PermissionsQuery{Role: "Editor"},
					want:  false,
				},
				{
					name:  "matching action",
					orgID: 1,
					query: PermissionsQuery{
						Role:   "Viewer",
						Action: "folders:read",
					},
					want: true,
				},
				{
					name:  "missing action",
					orgID: 1,
					query: PermissionsQuery{
						Role:   "Viewer",
						Action: "folders:write",
					},
					want: false,
				},
				{
					name:  "action set grants the action",
					orgID: 1,
					query: PermissionsQuery{
						Role:       "Viewer",
						Action:     "folders:write",
						ActionSets: []string{"folders:edit"},
					},
					want: true,
				},
			} {
				t.Run(tc.name, func(t *testing.T) {
					got, err := permissionStore.HasUserPermissions(ctx, types.NamespaceInfo{OrgID: tc.orgID}, tc.query)
					require.NoError(t, err)
					require.Equal(t, tc.want, got)
				})
			}

			actionSet, err := permissionStore.GetUserPermissions(ctx, types.NamespaceInfo{OrgID: 1}, PermissionsQuery{
				Role: "Viewer", Action: "folders:create", ActionSets: []string{"folders:edit"},
			})
			require.NoError(t, err)
			require.ElementsMatch(t, []string{"folders:uid:two", "folders:uid:three"}, permissionScopes(actionSet))
		})
	}
}

func permissionScopes(permissions []accesscontrol.Permission) []string {
	scopes := make([]string, 0, len(permissions))
	for _, permission := range permissions {
		scopes = append(scopes, permission.Scope)
	}
	return scopes
}

func TestIntegrationReportUIDLookup(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	db := sqlstore.NewTestStore(t)
	session := db.GetSqlxSession()
	ctx := t.Context()
	// A mapped table also exercises providers that qualify tenant table names.
	_, err := session.Exec(ctx, `CREATE TABLE report_uid_lookup_test (id BIGINT PRIMARY KEY, org_id BIGINT, uid VARCHAR(40))`)
	require.NoError(t, err)
	for _, row := range []struct {
		id, orgID int64
		uid       any
	}{
		{17, 1, "weekly"},
		{18, 2, "other-org"},
		{19, 1, ""},
		{20, 1, nil},
	} {
		_, err := session.Exec(ctx, `INSERT INTO report_uid_lookup_test (id, org_id, uid) VALUES (?, ?, ?)`, row.id, row.orgID, row.uid)
		require.NoError(t, err)
	}
	provider := func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return &legacysql.LegacyDatabaseHelper{DB: db, Table: func(name string) string {
			require.Equal(t, "report", name)
			return "report_uid_lookup_test"
		}}, nil
	}
	s := NewStore(provider, tracing.InitializeTracerForTest())
	for _, tc := range []struct {
		orgID, id int64
		want      string
		found     bool
	}{
		{1, 17, "weekly", true},
		{1, 18, "", false},
		{2, 18, "other-org", true},
		{3, 17, "", false},
		{1, 99, "", false},
		{1, 19, "", false},
		{1, 20, "", false},
	} {
		got, found, err := s.GetReportUIDByID(ctx, types.NamespaceInfo{OrgID: tc.orgID}, tc.id)
		require.NoError(t, err)
		require.Equal(t, tc.want, got)
		require.Equal(t, tc.found, found)
	}

	canceled, cancel := context.WithCancel(ctx)
	cancel()
	_, found, err := s.GetReportUIDByID(canceled, types.NamespaceInfo{OrgID: 1}, 17)
	require.ErrorIs(t, err, context.Canceled)
	require.False(t, found)
}

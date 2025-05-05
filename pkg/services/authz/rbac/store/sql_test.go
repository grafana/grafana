package store

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
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

	getPermissions := func(q *PermissionsQuery) sqltemplate.SQLTemplate {
		v := newGetPermissions(nodb, q)
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
			sqlUserPerms: {
				{
					Name: "viewer_user",
					Data: getPermissions(&PermissionsQuery{
						UserID: 1,
						OrgID:  1,
						Action: "folders:read",
						Role:   "Viewer",
					}),
				},
				{
					Name: "admin_user",
					Data: getPermissions(&PermissionsQuery{
						UserID:        1,
						OrgID:         1,
						Action:        "folders:read",
						Role:          "Admin",
						IsServerAdmin: true,
					}),
				},
				{
					Name: "user_with_teams",
					Data: getPermissions(&PermissionsQuery{
						UserID:  1,
						OrgID:   1,
						Action:  "folders:read",
						Role:    "None",
						TeamIDs: []int64{1, 2},
					}),
				},
				{
					Name: "anonymous_user",
					Data: getPermissions(&PermissionsQuery{
						OrgID:  1,
						Action: "folders:read",
						Role:   "Viewer",
					}),
				},
				{
					Name: "With_action_sets",
					Data: getPermissions(&PermissionsQuery{
						UserID:     1,
						OrgID:      1,
						Action:     "folders:create",
						ActionSets: []string{"folders:edit", "folders:admin"},
						Role:       "Viewer",
					}),
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

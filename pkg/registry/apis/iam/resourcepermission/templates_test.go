package resourcepermission

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestTemplates(t *testing.T) {
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "grafana." + n
		},
	}

	getInsertRole := func(orgID int64, name string, displayName string) sqltemplate.SQLTemplate {
		v := insertRoleTemplate{
			SQLTemplate: sqltemplate.New(nodb.DialectForDriver()),
			RoleTable:   nodb.Table("role"),
			OrgID:       orgID,
			UID:         name,
			Name:        displayName,
			Now:         "2025-07-22 15:00:00",
		}
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			roleInsertTplt: {
				{
					Name: "insert_role",
					Data: getInsertRole(
						8,
						accesscontrol.PrefixedRoleUID("managed:builtins:editor:1:permissions"+":org:8"),
						"managed:builtins:editor:1:permissions",
					),
				},
			},
		},
	})
}

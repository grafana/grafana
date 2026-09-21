package apikeyimpl

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestTemplates(t *testing.T) {
	dbHelper := &legacysql.LegacyDatabaseHelper{
		Table: func(name string) string {
			return "test_schema." + name
		},
	}

	countQuery := func(orgID int64) sqltemplate.SQLTemplate {
		return &countAPIKeysQuery{
			SQLTemplate: mocks.NewTestingSQLTemplate(),
			APIKeyTable: dbHelper.Table("api_key"),
			OrgID:       orgID,
		}
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: sqlTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			countAPIKeysTemplate: {
				{Name: "global", Data: countQuery(0)},
				{Name: "org", Data: countQuery(7)},
			},
		},
	})
}

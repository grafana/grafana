package playlist

import (
	"testing"
	"text/template"

	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate/mocks"
)

func TestPlaylistQueries(t *testing.T) {
	// prefix tables with grafana
	nodb := &legacysql.LegacyDatabaseHelper{
		Table: func(n string) string {
			return "grafana." + n
		},
	}

	getPlaylistQuery := func(q *playlistQuery) sqltemplate.SQLTemplate {
		v := newPlaylistQueryReq(nodb, q)
		v.SQLTemplate = mocks.NewTestingSQLTemplate()
		return &v
	}

	mocks.CheckQuerySnapshots(t, mocks.TemplateTestSetup{
		RootDir:        "testdata",
		SQLTemplatesFS: playlistSQLTemplatesFS,
		Templates: map[*template.Template][]mocks.TemplateTestCase{
			sqlQueryPlaylists: {
				{
					Name: "list",
					Data: getPlaylistQuery(&playlistQuery{
						OrgID: 1,
					}),
				},
			},
		},
	})
}

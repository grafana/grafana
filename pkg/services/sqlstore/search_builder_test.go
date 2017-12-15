package sqlstore

import (
	"testing"

	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	. "github.com/smartystreets/goconvey/convey"
)

func TestSearchBuilder(t *testing.T) {
	dialect = migrator.NewDialect("sqlite3")

	Convey("Testing building a search", t, func() {
		signedInUser := &m.SignedInUser{
			OrgId:  1,
			UserId: 1,
		}
		sb := NewSearchBuilder(signedInUser, 1000)

		Convey("When building a normal search", func() {
			sql, params := sb.IsStarred().WithTitle("test").ToSql()
			So(sql, ShouldStartWith, "SELECT")
			So(sql, ShouldContainSubstring, "INNER JOIN dashboard on ids.id = dashboard.id")
			So(sql, ShouldEndWith, "ORDER BY dashboard.title ASC LIMIT 5000")
			So(len(params), ShouldBeGreaterThan, 0)
		})

		Convey("When building a search with tag filter", func() {
			sql, params := sb.WithTags([]string{"tag1", "tag2"}).ToSql()
			So(sql, ShouldStartWith, "SELECT")
			So(sql, ShouldContainSubstring, "LEFT OUTER JOIN dashboard_tag")
			So(sql, ShouldEndWith, "ORDER BY dashboard.title ASC LIMIT 5000")
			So(len(params), ShouldBeGreaterThan, 0)
		})
	})
}

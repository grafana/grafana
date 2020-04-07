package sqlstore

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestSearchBuilder(t *testing.T) {
	Convey("Testing building a search", t, func() {
		signedInUser := &models.SignedInUser{
			OrgId:  1,
			UserId: 1,
		}

		sb := NewSearchBuilder(signedInUser, 1000, 0, models.PERMISSION_VIEW)

		Convey("When building a normal search", func() {
			sql, params := sb.IsStarred().WithTitle("test").ToSql()
			So(sql, ShouldStartWith, "SELECT")
			So(sql, ShouldContainSubstring, "INNER JOIN dashboard on ids.id = dashboard.id")
			So(sql, ShouldContainSubstring, "ORDER BY dashboard.title ASC")
			So(len(params), ShouldBeGreaterThan, 0)
		})

		Convey("When building a search with tag filter", func() {
			sql, params := sb.WithTags([]string{"tag1", "tag2"}).ToSql()
			So(sql, ShouldStartWith, "SELECT")
			So(sql, ShouldContainSubstring, "LEFT OUTER JOIN dashboard_tag")
			So(sql, ShouldContainSubstring, "ORDER BY dashboard.title ASC")
			So(len(params), ShouldBeGreaterThan, 0)
		})
	})
}

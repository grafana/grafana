package search

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestSearch(t *testing.T) {

	Convey("Given search query", t, func() {
		jsonDashIndex = NewJsonDashIndex("../../public/dashboards/")
		query := Query{}

		bus.AddHandler("test", func(query *FindPersistedDashboardsQuery) error {
			query.Result = HitList{
				&Hit{Id: 16, Title: "CCAA", Tags: []string{"BB", "AA"}},
				&Hit{Id: 10, Title: "AABB", Tags: []string{"CC", "AA"}},
				&Hit{Id: 15, Title: "BBAA", Tags: []string{"EE", "AA", "BB"}},
			}
			return nil
		})

		bus.AddHandler("test", func(query *m.GetUserStarsQuery) error {
			query.Result = map[int64]bool{10: true, 12: true}
			return nil
		})

		Convey("That is empty", func() {
			err := searchHandler(&query)
			So(err, ShouldBeNil)

			Convey("should return sorted results", func() {
				So(query.Result[0].Title, ShouldEqual, "AABB")
				So(query.Result[1].Title, ShouldEqual, "BBAA")
				So(query.Result[2].Title, ShouldEqual, "CCAA")
			})

			Convey("should return sorted tags", func() {
				So(query.Result[1].Tags[0], ShouldEqual, "AA")
				So(query.Result[1].Tags[1], ShouldEqual, "BB")
				So(query.Result[1].Tags[2], ShouldEqual, "EE")
			})
		})

	})
}

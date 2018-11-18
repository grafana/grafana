package search

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
)

func TestSearch(t *testing.T) {

	Convey("Given search query", t, func() {
		query := Query{Limit: 2000, SignedInUser: &m.SignedInUser{IsGrafanaAdmin: true}}
		ss := &SearchService{}

		bus.AddHandler("test", func(query *FindPersistedDashboardsQuery) error {
			query.Result = HitList{
				&Hit{Id: 16, Title: "CCAA", Type: "dash-db", Tags: []string{"BB", "AA"}},
				&Hit{Id: 10, Title: "AABB", Type: "dash-db", Tags: []string{"CC", "AA"}},
				&Hit{Id: 15, Title: "BBAA", Type: "dash-db", Tags: []string{"EE", "AA", "BB"}},
				&Hit{Id: 25, Title: "bbAAa", Type: "dash-db", Tags: []string{"EE", "AA", "BB"}},
				&Hit{Id: 17, Title: "FOLDER", Type: "dash-folder"},
			}
			return nil
		})

		bus.AddHandler("test", func(query *m.GetUserStarsQuery) error {
			query.Result = map[int64]bool{10: true, 12: true}
			return nil
		})

		bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
			query.Result = &m.SignedInUser{IsGrafanaAdmin: true}
			return nil
		})

		Convey("That is empty", func() {
			err := ss.searchHandler(&query)
			So(err, ShouldBeNil)

			Convey("should return sorted results", func() {
				So(query.Result[0].Title, ShouldEqual, "FOLDER")
				So(query.Result[1].Title, ShouldEqual, "AABB")
				So(query.Result[2].Title, ShouldEqual, "BBAA")
				So(query.Result[3].Title, ShouldEqual, "bbAAa")
				So(query.Result[4].Title, ShouldEqual, "CCAA")
			})

			Convey("should return sorted tags", func() {
				So(query.Result[3].Tags[0], ShouldEqual, "AA")
				So(query.Result[3].Tags[1], ShouldEqual, "BB")
				So(query.Result[3].Tags[2], ShouldEqual, "EE")
			})
		})

	})
}

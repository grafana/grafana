package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/annotations"
)

func TestAnnotations(t *testing.T) {
	Convey("Testing annotation saving/loading", t, func() {
		InitTestDB(t)

		repo := SqlAnnotationRepo{}

		Convey("Can save annotation", func() {

			err := repo.Save(&annotations.Item{
				OrgId:       1,
				UserId:      1,
				DashboardId: 1,
				Title:       "title",
				Text:        "hello",
				Epoch:       10,
				Data: simplejson.NewFromAny(map[string]interface{}{
					"tags": []string{"outage", "not my fault"},
				}),
			})

			So(err, ShouldBeNil)

			Convey("Can query for annotation", func() {
				items, err := repo.Find(&annotations.ItemQuery{
					OrgId:       1,
					DashboardId: 1,
					From:        0,
					To:          15,
				})

				So(err, ShouldBeNil)
				So(items, ShouldHaveLength, 1)

				Convey("Can read tags", func() {
					So(items[0].Data.Get("tags").MustStringArray(), ShouldResemble, []string{"outage", "not my fault"})
				})
			})

			Convey("Should not find any when item is outside time range", func() {
				items, err := repo.Find(&annotations.ItemQuery{
					OrgId:       1,
					DashboardId: 1,
					From:        12,
					To:          15,
				})

				So(err, ShouldBeNil)
				So(items, ShouldHaveLength, 0)
			})

			Convey("Should not find one when tag filter does not match", func() {
				items, err := repo.Find(&annotations.ItemQuery{
					OrgId:       1,
					DashboardId: 1,
					From:        1,
					To:          15,
					Tags:        []string{"asd"},
				})

				So(err, ShouldBeNil)
				So(items, ShouldHaveLength, 0)
			})

			Convey("Should find one when all tag filter does match", func() {
				items, err := repo.Find(&annotations.ItemQuery{
					OrgId:       1,
					DashboardId: 1,
					From:        1,
					To:          15,
					Tags:        []string{"outage", "not my fault"},
				})

				So(err, ShouldBeNil)
				So(items, ShouldHaveLength, 1)
			})
		})
	})
}

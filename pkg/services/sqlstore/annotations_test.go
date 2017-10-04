package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/services/annotations"
)

func TestSavingTags(t *testing.T) {
	Convey("Testing annotation saving/loading", t, func() {
		InitTestDB(t)

		repo := SqlAnnotationRepo{}

		Convey("Can save tags", func() {
			tags, err := repo.ensureTagsExist(newSession(), "outage,type:outage,server:server-1,error")

			So(err, ShouldBeNil)
			So(len(tags), ShouldEqual, 4)
		})
	})
}

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
				Tags:        "outage,error,type:outage,server:server-1",
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
					So(items[0].Tags, ShouldEqual, "outage,error,type:outage,server:server-1")
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
					Tags:        "asd",
				})

				So(err, ShouldBeNil)
				So(items, ShouldHaveLength, 0)
			})

			Convey("Should find one when all tag filters does match", func() {
				items, err := repo.Find(&annotations.ItemQuery{
					OrgId:       1,
					DashboardId: 1,
					From:        1,
					To:          15,
					Tags:        "outage,error",
				})

				So(err, ShouldBeNil)
				So(items, ShouldHaveLength, 1)
			})

			Convey("Should find one when all key value tag filters does match", func() {
				items, err := repo.Find(&annotations.ItemQuery{
					OrgId:       1,
					DashboardId: 1,
					From:        1,
					To:          15,
					Tags:        "type:outage,server:server-1",
				})

				So(err, ShouldBeNil)
				So(items, ShouldHaveLength, 1)
			})
		})
	})
}

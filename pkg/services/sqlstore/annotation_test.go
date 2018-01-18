package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/annotations"
)

func TestSavingTags(t *testing.T) {
	Convey("Testing annotation saving/loading", t, func() {
		InitTestDB(t)

		repo := SqlAnnotationRepo{}

		Convey("Can save tags", func() {
			tagPairs := []*models.Tag{
				{Key: "outage"},
				{Key: "type", Value: "outage"},
				{Key: "server", Value: "server-1"},
				{Key: "error"},
			}
			tags, err := repo.ensureTagsExist(newSession(), tagPairs)

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
			annotation := &annotations.Item{
				OrgId:       1,
				UserId:      1,
				DashboardId: 1,
				Text:        "hello",
				Type:        "alert",
				Epoch:       10,
				Tags:        []string{"outage", "error", "type:outage", "server:server-1"},
			}
			err := repo.Save(annotation)

			So(err, ShouldBeNil)
			So(annotation.Id, ShouldBeGreaterThan, 0)

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
					So(items[0].Tags, ShouldResemble, []string{"outage", "error", "type:outage", "server:server-1"})
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

			Convey("Should not find one when type filter does not match", func() {
				items, err := repo.Find(&annotations.ItemQuery{
					OrgId:       1,
					DashboardId: 1,
					From:        1,
					To:          15,
					Type:        "alert",
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
					Tags:        []string{"outage", "error"},
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
					Tags:        []string{"type:outage", "server:server-1"},
				})

				So(err, ShouldBeNil)
				So(items, ShouldHaveLength, 1)
			})

			Convey("Can update annotation and remove all tags", func() {
				query := &annotations.ItemQuery{
					OrgId:       1,
					DashboardId: 1,
					From:        0,
					To:          15,
				}
				items, err := repo.Find(query)

				So(err, ShouldBeNil)

				annotationId := items[0].Id

				err = repo.Update(&annotations.Item{
					Id:    annotationId,
					OrgId: 1,
					Text:  "something new",
					Tags:  []string{},
				})

				So(err, ShouldBeNil)

				items, err = repo.Find(query)

				So(err, ShouldBeNil)

				Convey("Can read tags", func() {
					So(items[0].Id, ShouldEqual, annotationId)
					So(len(items[0].Tags), ShouldEqual, 0)
					So(items[0].Text, ShouldEqual, "something new")
				})
			})

			Convey("Can update annotation with new tags", func() {
				query := &annotations.ItemQuery{
					OrgId:       1,
					DashboardId: 1,
					From:        0,
					To:          15,
				}
				items, err := repo.Find(query)

				So(err, ShouldBeNil)

				annotationId := items[0].Id

				err = repo.Update(&annotations.Item{
					Id:    annotationId,
					OrgId: 1,
					Text:  "something new",
					Tags:  []string{"newtag1", "newtag2"},
				})

				So(err, ShouldBeNil)

				items, err = repo.Find(query)

				So(err, ShouldBeNil)

				Convey("Can read tags", func() {
					So(items[0].Id, ShouldEqual, annotationId)
					So(items[0].Tags, ShouldResemble, []string{"newtag1", "newtag2"})
					So(items[0].Text, ShouldEqual, "something new")
				})
			})

			Convey("Can delete annotation", func() {
				query := &annotations.ItemQuery{
					OrgId:       1,
					DashboardId: 1,
					From:        0,
					To:          15,
				}
				items, err := repo.Find(query)
				So(err, ShouldBeNil)

				annotationId := items[0].Id

				err = repo.Delete(&annotations.DeleteParams{Id: annotationId})

				items, err = repo.Find(query)
				So(err, ShouldBeNil)

				Convey("Should be deleted", func() {
					So(len(items), ShouldEqual, 0)
				})
			})

		})
	})
}

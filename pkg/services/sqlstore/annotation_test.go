package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/annotations"
)

func TestSavingTags(t *testing.T) {
	InitTestDB(t)

	Convey("Testing annotation saving/loading", t, func() {

		repo := SqlAnnotationRepo{}

		Convey("Can save tags", func() {
			Reset(func() {
				_, err := x.Exec("DELETE FROM annotation_tag WHERE 1=1")
				So(err, ShouldBeNil)
			})

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
	InitTestDB(t)

	Convey("Testing annotation saving/loading", t, func() {
		repo := SqlAnnotationRepo{}

		Convey("Can save annotation", func() {
			Reset(func() {
				_, err := x.Exec("DELETE FROM annotation WHERE 1=1")
				So(err, ShouldBeNil)
				_, err = x.Exec("DELETE FROM annotation_tag WHERE 1=1")
				So(err, ShouldBeNil)
			})

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

			annotation2 := &annotations.Item{
				OrgId:       1,
				UserId:      1,
				DashboardId: 2,
				Text:        "hello",
				Type:        "alert",
				Epoch:       20,
				Tags:        []string{"outage", "error", "type:outage", "server:server-1"},
				RegionId:    1,
			}
			err = repo.Save(annotation2)
			So(err, ShouldBeNil)
			So(annotation2.Id, ShouldBeGreaterThan, 0)

			globalAnnotation1 := &annotations.Item{
				OrgId:  1,
				UserId: 1,
				Text:   "deploy",
				Type:   "",
				Epoch:  15,
				Tags:   []string{"deploy"},
			}
			err = repo.Save(globalAnnotation1)
			So(err, ShouldBeNil)
			So(globalAnnotation1.Id, ShouldBeGreaterThan, 0)

			globalAnnotation2 := &annotations.Item{
				OrgId:  1,
				UserId: 1,
				Text:   "rollback",
				Type:   "",
				Epoch:  17,
				Tags:   []string{"rollback"},
			}
			err = repo.Save(globalAnnotation2)
			So(err, ShouldBeNil)
			So(globalAnnotation2.Id, ShouldBeGreaterThan, 0)

			Convey("Can query for annotation by dashboard id", func() {
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

				Convey("Has created and updated values", func() {
					So(items[0].Created, ShouldBeGreaterThan, 0)
					So(items[0].Updated, ShouldBeGreaterThan, 0)
					So(items[0].Updated, ShouldEqual, items[0].Created)
				})
			})

			Convey("Can query for annotation by id", func() {
				items, err := repo.Find(&annotations.ItemQuery{
					OrgId:        1,
					AnnotationId: annotation2.Id,
				})

				So(err, ShouldBeNil)
				So(items, ShouldHaveLength, 1)
				So(items[0].Id, ShouldEqual, annotation2.Id)
			})

			Convey("Can query for annotation by region id", func() {
				items, err := repo.Find(&annotations.ItemQuery{
					OrgId:    1,
					RegionId: annotation2.RegionId,
				})

				So(err, ShouldBeNil)
				So(items, ShouldHaveLength, 1)
				So(items[0].Id, ShouldEqual, annotation2.Id)
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
					To:          15, //this will exclude the second test annotation
					Tags:        []string{"outage", "error"},
				})

				So(err, ShouldBeNil)
				So(items, ShouldHaveLength, 1)
			})

			Convey("Should find two annotations using partial match", func() {
				items, err := repo.Find(&annotations.ItemQuery{
					OrgId:    1,
					From:     1,
					To:       25,
					MatchAny: true,
					Tags:     []string{"rollback", "deploy"},
				})

				So(err, ShouldBeNil)
				So(items, ShouldHaveLength, 2)
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

				Convey("Updated time has increased", func() {
					So(items[0].Updated, ShouldBeGreaterThan, items[0].Created)
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

				err = repo.Delete(&annotations.DeleteParams{Id: annotationId, OrgId: 1})
				So(err, ShouldBeNil)

				items, err = repo.Find(query)
				So(err, ShouldBeNil)

				Convey("Should be deleted", func() {
					So(len(items), ShouldEqual, 0)
				})
			})

		})
	})
}

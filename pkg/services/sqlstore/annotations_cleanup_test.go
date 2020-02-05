package sqlstore

import (
	"github.com/grafana/grafana/pkg/services/annotations"
	"testing"
	"time"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func (r *SqlAnnotationRepo) addTestAnnotation(dashboard *m.Dashboard, repo SqlAnnotationRepo, daysToKeep int, item *annotations.Item) error {
	return inTransaction(func(sess *DBSession) error {
		tags := m.ParseTagPairs([]string{"outage", "error", "type:outage", "server:server-1"})
		item.Tags = m.JoinTagPairs(tags)
		item.Text = "hello"
		item.Type = "alert"
		item.UserId = 1
		item.OrgId = dashboard.OrgId
		item.DashboardId = dashboard.Id
		item.Created = (time.Now().Unix() - int64(daysToKeep*2*86400)) * 1000
		item.Updated = item.Created
		if item.Epoch == 0 {
			item.Epoch = item.Created
			item.EpochEnd = item.Created
		}

		_, err := sess.Table("annotation").Insert(item)
		if err != nil {
			return err
		}

		if item.Tags != nil {
			tags, err := EnsureTagsExist(sess, tags)
			if err != nil {
				return err
			}
			for _, tag := range tags {
				if _, err := sess.Exec("INSERT INTO annotation_tag (annotation_id, tag_id) VALUES(?,?)", item.Id, tag.Id); err != nil {
					return err
				}
			}
		}
		return nil
	})
}

func TestDeleteExpiredAnnotations(t *testing.T) {
	Convey("Testing annotations history clean up", t, func() {
		InitTestDB(t)
		repo := SqlAnnotationRepo{}
		daysToKeepAnnotations := 5
		annotationsToWrite := 10
		setting.DaysToKeepAnnotations = daysToKeepAnnotations

		savedDash := insertTestDashboard("test dash 111", 1, 0, false, "this-is-fun")
		for i := 0; i < annotationsToWrite-1; i++ {
			err := repo.addTestAnnotation(savedDash, repo, daysToKeepAnnotations, &annotations.Item{OrgId: 1})
			So(err, ShouldBeNil)
		}

		// add one recent
		err := repo.addTestAnnotation(savedDash, repo, 1, &annotations.Item{OrgId: 1})
		So(err, ShouldBeNil)

		Convey("Clean up old annotations", func() {
			err := deleteExpiredAnnotations(&m.DeleteExpiredVAnnotationsCommand{})
			So(err, ShouldBeNil)

			from := (time.Now().Unix() - int64(annotationsToWrite*86400)) * 1000
			to := time.Now().Unix() * 1000

			items, _ := repo.Find(&annotations.ItemQuery{
				OrgId:       1,
				DashboardId: 1,
				From:        from,
				To:          to,
			})

			So(len(items), ShouldEqual, 1)
			Convey("Can read tags", func() {
				So(items[0].Tags, ShouldResemble, []string{"outage", "error", "type:outage", "server:server-1"})
			})
		})

		Convey("Don't delete anything if there're no expired versions", func() {
			setting.DaysToKeepAnnotations = annotationsToWrite

			err := deleteExpiredAnnotations(&m.DeleteExpiredVAnnotationsCommand{})
			So(err, ShouldBeNil)

			items, _ := repo.Find(&annotations.ItemQuery{
				OrgId:       1,
				DashboardId: 1,
			})

			So(len(items), ShouldEqual, 1)
		})

		Convey("Don't delete more than MAX_VERSIONS_TO_DELETE per iteration", func() {
			annotationsToWriteBigNumber := MAX_HISTORY_ENTRIES_TO_DELETE + annotationsToWrite
			for i := 0; i < annotationsToWriteBigNumber-annotationsToWrite; i++ {
				err := repo.addTestAnnotation(savedDash, repo, daysToKeepAnnotations, &annotations.Item{OrgId: 1})
				So(err, ShouldBeNil)
			}

			err := deleteExpiredAnnotations(&m.DeleteExpiredVAnnotationsCommand{})
			So(err, ShouldBeNil)

			items, _ := repo.Find(&annotations.ItemQuery{
				OrgId:       1,
				DashboardId: 1,
			})

			// Ensure we have at least daysToKeepAnnotations versions
			So(len(items), ShouldBeGreaterThanOrEqualTo, daysToKeepAnnotations)
			// Ensure we haven't deleted more than MAX_VERSIONS_TO_DELETE rows
			So(annotationsToWriteBigNumber-len(items), ShouldBeLessThanOrEqualTo, MAX_HISTORY_ENTRIES_TO_DELETE)
		})
	})
}

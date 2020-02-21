package sqlstore

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/annotations"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
)

func addTestAnnotation(dashboard *models.Dashboard, created int64, sess *DBSession) error {
	created *= 1000
	tags := models.ParseTagPairs([]string{"outage", "error", "type:outage", "server:server-1"})

	item := annotations.Item{
		Tags:        models.JoinTagPairs(tags),
		Text:        "hello",
		Type:        "alert",
		UserId:      1,
		OrgId:       dashboard.OrgId,
		DashboardId: dashboard.Id,
		Created:     created,
		Updated:     created,
		Epoch:       created,
		EpochEnd:    created,
	}
	if _, err := sess.Table("annotation").Insert(&item); err != nil {
		return err
	}

	// Get tag IDs
	tags, err := EnsureTagsExist(sess, tags)
	if err != nil {
		return err
	}
	for _, tag := range tags {
		if _, err := sess.Exec("INSERT INTO annotation_tag (annotation_id, tag_id) VALUES(?,?)", item.Id, tag.Id); err != nil {
			return err
		}
	}

	return nil
}

func TestDeleteExpiredAnnotations(t *testing.T) {
	daysToKeepAnnotations := 5
	repo := SqlAnnotationRepo{}

	annotationsToWrite := 10

	InitTestDB(t)
	savedDash := insertNewTestDashboard(t,"test dash 111", 1, 0, false, "this-is-fun")

	expiredCreated := (time.Now().Unix() - int64(daysToKeepAnnotations*86400))
	err := inTransaction(func(sess *DBSession) error {
		for i := 0; i < annotationsToWrite-1; i++ {
			if err := addTestAnnotation(savedDash, expiredCreated, sess); err != nil {
				return err
			}
		}

		// Add a non-expired one
		newCreated := (time.Now().Unix() - int64(2*86400))
		return addTestAnnotation(savedDash, newCreated, sess)
	})
	assert.Nil(t, err)



	err = deleteExpiredAnnotations(&models.DeleteExpiredAnnotationsCommand{DaysToKeep: daysToKeepAnnotations})
	assert.Nil(t, err)

	items, err := repo.Find(&annotations.ItemQuery{
		OrgId:       savedDash.OrgId,
		DashboardId: savedDash.Id,
	})
	assert.Nil(t, err)

	assert.Equal(t, len(items), 1)
	assert.ElementsMatch(t, items[0].Tags, []string{"outage", "error", "type:outage", "server:server-1"}, "Can read tags")



	err = deleteExpiredAnnotations(&models.DeleteExpiredAnnotationsCommand{DaysToKeep: daysToKeepAnnotations})
	assert.Nil(t, err)

	items, err = repo.Find(&annotations.ItemQuery{
		OrgId:       savedDash.OrgId,
		DashboardId: savedDash.Id,
	})
	assert.Nil(t, err)

	assert.Equal(t, len(items), 1)

}

func TestDeleteExpiredAnnotationsMax(t *testing.T) {
	daysToKeepAnnotations := 5
	repo := SqlAnnotationRepo{}

	InitTestDB(t)
	savedDash := insertNewTestDashboard(t,"test dash 111", 1, 0, false, "this-is-fun")

	numAnnotations := MAX_EXPIRED_ANNOTATIONS_TO_DELETE + 10
	err := inTransaction(func(sess *DBSession) error {
		created := (time.Now().Unix() - int64(daysToKeepAnnotations*86400))
		for i := 0; i < numAnnotations; i++ {
			if err := addTestAnnotation(savedDash, created, sess); err != nil {
				return err
			}
		}
		return nil
	})
	assert.Nil(t, err)

	err = deleteExpiredAnnotations(&models.DeleteExpiredAnnotationsCommand{})
	assert.Nil(t, err)

	items, err := repo.Find(&annotations.ItemQuery{
		OrgId:       savedDash.OrgId,
		DashboardId: savedDash.Id,
	})
	assert.Nil(t, err)

	assert.Equal(t, len(items), numAnnotations-MAX_EXPIRED_ANNOTATIONS_TO_DELETE)
}

func insertNewTestDashboard(t *testing.T,title string, orgId int64, folderId int64, isFolder bool, tags ...interface{}) *models.Dashboard {
	cmd := models.SaveDashboardCommand{
		OrgId:    orgId,
		FolderId: folderId,
		IsFolder: isFolder,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
			"tags":  tags,
		}),
	}

	err := SaveDashboard(&cmd)
	assert.Nil(t, err)

	cmd.Result.Data.Set("id", cmd.Result.Id)
	cmd.Result.Data.Set("uid", cmd.Result.Uid)

	return cmd.Result
}

package annotationsimpl

import (
	"context"
	"errors"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIntegrationAnnotationCleanUp(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	fakeSQL := db.InitTestDB(t)

	tests := []struct {
		name                    string
		createAnnotationsNum    int
		createOldAnnotationsNum int

		cfg                           *setting.Cfg
		alertAnnotationCount          int64
		annotationCleanupJobBatchSize int
		dashboardAnnotationCount      int64
		APIAnnotationCount            int64
		affectedAnnotations           int64
	}{
		{
			name:                          "default settings should not delete any annotations",
			createAnnotationsNum:          21,
			createOldAnnotationsNum:       6,
			annotationCleanupJobBatchSize: 1,
			cfg: &setting.Cfg{
				AlertingAnnotationCleanupSetting:   settingsFn(0, 0),
				DashboardAnnotationCleanupSettings: settingsFn(0, 0),
				APIAnnotationCleanupSettings:       settingsFn(0, 0),
			},
			alertAnnotationCount:     7,
			dashboardAnnotationCount: 7,
			APIAnnotationCount:       7,
			affectedAnnotations:      0,
		},
		{
			name:                          "should remove annotations created before cut off point",
			createAnnotationsNum:          21,
			createOldAnnotationsNum:       6,
			annotationCleanupJobBatchSize: 1,
			cfg: &setting.Cfg{
				AlertingAnnotationCleanupSetting:   settingsFn(time.Hour*48, 0),
				DashboardAnnotationCleanupSettings: settingsFn(time.Hour*48, 0),
				APIAnnotationCleanupSettings:       settingsFn(time.Hour*48, 0),
			},
			alertAnnotationCount:     5,
			dashboardAnnotationCount: 5,
			APIAnnotationCount:       5,
			affectedAnnotations:      6,
		},
		{
			name:                          "should only keep three annotations",
			createAnnotationsNum:          15,
			createOldAnnotationsNum:       6,
			annotationCleanupJobBatchSize: 1,
			cfg: &setting.Cfg{
				AlertingAnnotationCleanupSetting:   settingsFn(0, 3),
				DashboardAnnotationCleanupSettings: settingsFn(0, 3),
				APIAnnotationCleanupSettings:       settingsFn(0, 3),
			},
			alertAnnotationCount:     3,
			dashboardAnnotationCount: 3,
			APIAnnotationCount:       3,
			affectedAnnotations:      6,
		},
		{
			name:                          "running the max count delete again should not remove any annotations",
			createAnnotationsNum:          9,
			createOldAnnotationsNum:       6,
			annotationCleanupJobBatchSize: 1,
			cfg: &setting.Cfg{
				AlertingAnnotationCleanupSetting:   settingsFn(0, 3),
				DashboardAnnotationCleanupSettings: settingsFn(0, 3),
				APIAnnotationCleanupSettings:       settingsFn(0, 3),
			},
			alertAnnotationCount:     3,
			dashboardAnnotationCount: 3,
			APIAnnotationCount:       3,
			affectedAnnotations:      0,
		},
		{
			name:                          "should not fail if batch size is larger than SQLITE_MAX_VARIABLE_NUMBER for SQLite >= 3.32.0",
			createAnnotationsNum:          40003,
			createOldAnnotationsNum:       0,
			annotationCleanupJobBatchSize: 32767,
			cfg: &setting.Cfg{
				AlertingAnnotationCleanupSetting:   settingsFn(0, 1),
				DashboardAnnotationCleanupSettings: settingsFn(0, 1),
				APIAnnotationCleanupSettings:       settingsFn(0, 1),
			},
			alertAnnotationCount:     1,
			dashboardAnnotationCount: 1,
			APIAnnotationCount:       1,
			affectedAnnotations:      40000,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			createTestAnnotations(t, fakeSQL, test.createAnnotationsNum, test.createOldAnnotationsNum)
			assertAnnotationCount(t, fakeSQL, "", int64(test.createAnnotationsNum))
			assertAnnotationTagCount(t, fakeSQL, 2*int64(test.createAnnotationsNum))

			t.Cleanup(func() {
				err := fakeSQL.WithDbSession(context.Background(), func(session *db.Session) error {
					_, deleteAnnotationErr := session.Exec("DELETE FROM annotation WHERE true")
					_, deleteAnnotationTagErr := session.Exec("DELETE FROM annotation_tag WHERE true")
					return errors.Join(deleteAnnotationErr, deleteAnnotationTagErr)
				})
				assert.NoError(t, err)
			})

			cfg := setting.NewCfg()
			cfg.AnnotationCleanupJobBatchSize = int64(test.annotationCleanupJobBatchSize)
			cleaner := ProvideCleanupService(fakeSQL, setting.ProvideService(cfg))
			affectedAnnotations, affectedAnnotationTags, err := cleaner.Run(context.Background(), test.cfg)
			require.NoError(t, err)

			assert.Equal(t, test.affectedAnnotations, affectedAnnotations)
			assert.Equal(t, test.affectedAnnotations*2, affectedAnnotationTags)

			assertAnnotationCount(t, fakeSQL, alertAnnotationType, test.alertAnnotationCount)
			assertAnnotationCount(t, fakeSQL, dashboardAnnotationType, test.dashboardAnnotationCount)
			assertAnnotationCount(t, fakeSQL, apiAnnotationType, test.APIAnnotationCount)

			// we create two records in annotation_tag for each sample annotation
			expectedAnnotationTagCount := (test.alertAnnotationCount +
				test.dashboardAnnotationCount +
				test.APIAnnotationCount) * 2
			assertAnnotationTagCount(t, fakeSQL, expectedAnnotationTagCount)
		})
	}
}

func TestIntegrationOldAnnotationsAreDeletedFirst(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	fakeSQL := db.InitTestDB(t)

	t.Cleanup(func() {
		err := fakeSQL.WithDbSession(context.Background(), func(session *db.Session) error {
			_, err := session.Exec("DELETE FROM annotation WHERE true")
			return err
		})
		assert.NoError(t, err)
	})

	// create some test annotations
	a := annotations.Item{
		DashboardID: 1,
		OrgID:       1,
		UserID:      1,
		PanelID:     1,
		AlertID:     10,
		Text:        "",
		Created:     time.Now().AddDate(-10, 0, -10).UnixNano() / int64(time.Millisecond),
	}

	err := fakeSQL.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Insert(a)
		require.NoError(t, err, "cannot insert annotation")
		_, err = sess.Insert(a)
		require.NoError(t, err, "cannot insert annotation")

		a.AlertID = 20
		_, err = sess.Insert(a)
		require.NoError(t, err, "cannot insert annotation")

		// run the clean up task to keep one annotation.
		cfg := setting.NewCfg()
		cfg.AnnotationCleanupJobBatchSize = 1
		cleaner := NewXormStore(setting.ProvideService(cfg), log.New("annotation.test"), fakeSQL, nil)
		_, err = cleaner.CleanAnnotations(context.Background(), setting.AnnotationCleanupSettings{MaxCount: 1}, alertAnnotationType)
		require.NoError(t, err)

		// assert that the last annotations were kept
		countNew, err := sess.Where("alert_id = 20").Count(&annotations.Item{})
		require.NoError(t, err)
		require.Equal(t, int64(1), countNew, "the last annotations should be kept")

		countOld, err := sess.Where("alert_id = 10").Count(&annotations.Item{})
		require.NoError(t, err)
		require.Equal(t, int64(0), countOld, "the two first annotations should have been deleted")

		return nil
	})
	require.NoError(t, err)
}

func assertAnnotationCount(t *testing.T, fakeSQL db.DB, sql string, expectedCount int64) {
	t.Helper()

	err := fakeSQL.WithDbSession(context.Background(), func(sess *db.Session) error {
		count, err := sess.Where(sql).Count(&annotations.Item{})
		require.NoError(t, err)
		require.Equal(t, expectedCount, count)
		return nil
	})
	require.NoError(t, err)
}

func assertAnnotationTagCount(t *testing.T, fakeSQL db.DB, expectedCount int64) {
	t.Helper()

	err := fakeSQL.WithDbSession(context.Background(), func(sess *db.Session) error {
		count, err := sess.SQL("select count(*) from annotation_tag").Count()
		require.NoError(t, err)
		require.Equal(t, expectedCount, count)
		return nil
	})
	require.NoError(t, err)
}

func createTestAnnotations(t *testing.T, store db.DB, expectedCount int, oldAnnotations int) {
	t.Helper()

	cutoffDate := time.Now()

	newAnnotations := make([]*annotations.Item, 0, expectedCount)
	newAnnotationTags := make([]*annotationTag, 0, 2*expectedCount)
	for i := 0; i < expectedCount; i++ {
		a := &annotations.Item{
			ID:           int64(i + 1),
			DashboardID:  1,
			DashboardUID: "uid" + strconv.Itoa(i),
			OrgID:        1,
			UserID:       1,
			PanelID:      1,
			Text:         "",
		}

		// mark every third as an API annotation
		// that does not belong to a dashboard
		if i%3 == 1 {
			a.DashboardID = 0 // nolint: staticcheck
			a.DashboardUID = ""
		}

		// mark every third annotation as an alert annotation
		if i%3 == 0 {
			a.AlertID = 10
			a.DashboardID = 2 // nolint: staticcheck
			a.DashboardUID = "dashboard2uid"
		}

		// create epoch as int annotations.go line 40
		a.Created = cutoffDate.UnixNano() / int64(time.Millisecond)

		// set a really old date for the first six annotations
		if i < oldAnnotations {
			a.Created = cutoffDate.AddDate(-10, 0, -10).UnixNano() / int64(time.Millisecond)
		}

		newAnnotations = append(newAnnotations, a)
		newAnnotationTags = append(newAnnotationTags, &annotationTag{AnnotationID: a.ID, TagID: 1}, &annotationTag{AnnotationID: a.ID, TagID: 2})
	}

	err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
		batchsize := 500
		for i := 0; i < len(newAnnotations); i += batchsize {
			_, err := sess.InsertMulti(newAnnotations[i:min(i+batchsize, len(newAnnotations))])
			require.NoError(t, err)
		}
		return nil
	})
	require.NoError(t, err)

	err = store.WithDbSession(context.Background(), func(sess *db.Session) error {
		batchsize := 500
		for i := 0; i < len(newAnnotationTags); i += batchsize {
			_, err := sess.InsertMulti(newAnnotationTags[i:min(i+batchsize, len(newAnnotationTags))])
			require.NoError(t, err)
		}
		return nil
	})
	require.NoError(t, err)
}

func settingsFn(maxAge time.Duration, maxCount int64) setting.AnnotationCleanupSettings {
	return setting.AnnotationCleanupSettings{MaxAge: maxAge, MaxCount: maxCount}
}

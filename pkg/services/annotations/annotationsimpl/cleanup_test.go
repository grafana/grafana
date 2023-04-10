package annotationsimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestAnnotationCleanUp(t *testing.T) {
	fakeSQL := db.InitTestDB(t)

	t.Cleanup(func() {
		err := fakeSQL.WithDbSession(context.Background(), func(session *db.Session) error {
			_, err := session.Exec("DELETE FROM annotation")
			return err
		})
		assert.NoError(t, err)
	})

	createTestAnnotations(t, fakeSQL, 21, 6)

	tests := []struct {
		name                     string
		cfg                      *setting.Cfg
		alertAnnotationCount     int64
		dashboardAnnotationCount int64
		APIAnnotationCount       int64
		affectedAnnotations      int64
	}{
		{
			name: "default settings should not delete any annotations",
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
			name: "should remove annotations created before cut off point",
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
			name: "should only keep three annotations",
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
			name: "running the max count delete again should not remove any annotations",
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
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.AnnotationCleanupJobBatchSize = 1
			cleaner := ProvideCleanupService(fakeSQL, cfg, featuremgmt.WithFeatures())
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

func TestOldAnnotationsAreDeletedFirst(t *testing.T) {
	fakeSQL := db.InitTestDB(t)

	t.Cleanup(func() {
		err := fakeSQL.WithDbSession(context.Background(), func(session *db.Session) error {
			_, err := session.Exec("DELETE FROM annotation")
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
		cleaner := &xormRepositoryImpl{cfg: cfg, log: log.New("test-logger"), db: fakeSQL, features: featuremgmt.WithFeatures()}
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

func TestAnnotationCleanUp_Timeout(t *testing.T) {
	annotationCount := 21 // createTestAnnotations works best in multiples of 3
	fakeSQL := db.InitTestDB(t)
	cfg := setting.NewCfg()
	cfg.AnnotationCleanupJobBatchSize = 100 // batch size > total number of annotations
	createTestAnnotations(t, fakeSQL, annotationCount, 6)
	cleaner := ProvideCleanupService(fakeSQL, cfg, &featuremgmt.FeatureManager{})

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	// configuration to delete all but one of everything
	cfg.AlertingAnnotationCleanupSetting = settingsFn(0, 1)
	cfg.DashboardAnnotationCleanupSettings = settingsFn(0, 1)
	cfg.APIAnnotationCleanupSettings = settingsFn(0, 1)

	go func() {
		time.Sleep(1 * time.Second)
		_, _, err := cleaner.Run(ctx, cfg)
		require.ErrorIs(t, err, context.DeadlineExceeded)
	}()

	// nothing should have been deleted!
	assertAnnotationCount(t, fakeSQL, "", int64(annotationCount))
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

	for i := 0; i < expectedCount; i++ {
		a := &annotations.Item{
			DashboardID: 1,
			OrgID:       1,
			UserID:      1,
			PanelID:     1,
			Text:        "",
		}

		// mark every third as an API annotation
		// that does not belong to a dashboard
		if i%3 == 1 {
			a.DashboardID = 0
		}

		// mark every third annotation as an alert annotation
		if i%3 == 0 {
			a.AlertID = 10
			a.DashboardID = 2
		}

		// create epoch as int annotations.go line 40
		a.Created = cutoffDate.UnixNano() / int64(time.Millisecond)

		// set a really old date for the first six annotations
		if i < oldAnnotations {
			a.Created = cutoffDate.AddDate(-10, 0, -10).UnixNano() / int64(time.Millisecond)
		}

		err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.Insert(a)
			require.NoError(t, err)

			// mimick the SQL annotation Save logic by writing records to the annotation_tag table
			// we need to ensure they get deleted when we clean up annotations
			for tagID := range []int{1, 2} {
				_, err = sess.Exec("INSERT INTO annotation_tag (annotation_id, tag_id) VALUES(?,?)", a.ID, tagID)
				require.NoError(t, err)
			}
			return err
		})
		require.NoError(t, err)
	}

	assertAnnotationCount(t, store, "", int64(expectedCount))
	assertAnnotationTagCount(t, store, int64(expectedCount*2))
}

func settingsFn(maxAge time.Duration, maxCount int64) setting.AnnotationCleanupSettings {
	return setting.AnnotationCleanupSettings{MaxAge: maxAge, MaxCount: maxCount}
}

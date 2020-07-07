// +build integration

package sqlstore

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestAnnotationCleanUp(t *testing.T) {
	fakeSQL := InitTestDB(t)
	repo := &SqlAnnotationRepo{}

	createTestAnnotations(t, repo, fakeSQL)
	assertAnnotationCount(t, fakeSQL, "", 21)

	tests := []struct {
		name                     string
		cfg                      *setting.Cfg
		alertAnnotationCount     int64
		dashboardAnnotationCount int64
		APIAnnotationCount       int64
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
		},
		{
			name: "running the max count delete again should not remove an annotations",
			cfg: &setting.Cfg{
				AlertingAnnotationCleanupSetting:   settingsFn(0, 3),
				DashboardAnnotationCleanupSettings: settingsFn(0, 3),
				APIAnnotationCleanupSettings:       settingsFn(0, 3),
			},
			alertAnnotationCount:     3,
			dashboardAnnotationCount: 3,
			APIAnnotationCount:       3,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			cleaner := &AnnotationCleanupService{BatchSize: 1, SQLStore: fakeSQL}
			err := cleaner.CleanAnnotations(context.Background(), test.cfg)
			require.Nil(t, err)

			assertAnnotationCount(t, fakeSQL, AlertAnnotationType, test.alertAnnotationCount)
			assertAnnotationCount(t, fakeSQL, DashboardAnnotationType, test.dashboardAnnotationCount)
			assertAnnotationCount(t, fakeSQL, APIAnnotationType, test.APIAnnotationCount)
		})
	}
}

func assertAnnotationCount(t *testing.T, fakeSQL *SqlStore, sql string, expectedCount int64) {
	t.Helper()

	session := fakeSQL.NewSession()
	defer session.Close()
	count, err := session.Where(sql).Count(&annotations.Item{})
	require.Nil(t, err, "cound should not return error")
	require.Equal(t, expectedCount, count)
}

func createTestAnnotations(t *testing.T, repo *SqlAnnotationRepo, sqlstore *SqlStore) {
	t.Helper()

	cutoffDate := time.Now()

	for i := 0; i < 21; i++ {
		a := &annotations.Item{
			DashboardId: 1,
			OrgId:       1,
			UserId:      1,
			PanelId:     1,
			Text:        "",
		}

		// mark every thired as an API annotation
		// that doesnt belong to a dashboard
		if i%3 == 1 {
			a.DashboardId = 0
		}

		// mark every thired annotations as an alert annotation
		if i%3 == 0 {
			a.AlertId = 10
			a.DashboardId = 2
		}

		// create epoch as int annotations.go line 40
		a.Created = cutoffDate.UnixNano() / int64(time.Millisecond)

		// set a really old date for the first six annotations
		if i < 6 {
			a.Created = cutoffDate.AddDate(-10, 0, -10).UnixNano() / int64(time.Millisecond)
		}

		_, err := sqlstore.NewSession().Insert(a)
		require.Nil(t, err, "should be able to save annotation", err)
	}
}

func settingsFn(maxAge time.Duration, maxCount int64) setting.AnnotationCleanupSettings {
	return setting.AnnotationCleanupSettings{MaxAge: maxAge, MaxCount: maxCount}
}

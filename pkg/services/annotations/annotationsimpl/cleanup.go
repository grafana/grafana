package annotationsimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// CleanupServiceImpl is responsible for cleaning old annotations.
type CleanupServiceImpl struct {
	store store
}

func ProvideCleanupService(db db.DB, settingsProvider setting.SettingsProvider) *CleanupServiceImpl {
	return &CleanupServiceImpl{
		store: NewXormStore(settingsProvider, log.New("annotations"), db, nil),
	}
}

const (
	alertAnnotationType     = "alert_id <> 0"
	dashboardAnnotationType = "dashboard_id <> 0 AND alert_id = 0"
	apiAnnotationType       = "alert_id = 0 AND dashboard_id = 0"
)

// Run deletes old annotations created by alert rules, API
// requests and human made in the UI. It subsequently deletes orphaned rows
// from the annotation_tag table. Cleanup actions are performed in batches
// so that no query takes too long to complete.
//
// Returns the number of annotation and annotation_tag rows deleted. If an
// error occurs, it returns the number of rows affected so far.
func (cs *CleanupServiceImpl) Run(ctx context.Context, cfg *setting.Cfg) (int64, int64, error) {
	var totalCleanedAnnotations int64
	affected, err := cs.store.CleanAnnotations(ctx, cfg.AlertingAnnotationCleanupSetting, alertAnnotationType)
	totalCleanedAnnotations += affected
	if err != nil {
		return totalCleanedAnnotations, 0, err
	}

	affected, err = cs.store.CleanAnnotations(ctx, cfg.APIAnnotationCleanupSettings, apiAnnotationType)
	totalCleanedAnnotations += affected
	if err != nil {
		return totalCleanedAnnotations, 0, err
	}

	affected, err = cs.store.CleanAnnotations(ctx, cfg.DashboardAnnotationCleanupSettings, dashboardAnnotationType)
	totalCleanedAnnotations += affected
	if err != nil {
		return totalCleanedAnnotations, 0, err
	}
	if totalCleanedAnnotations > 0 {
		affected, err = cs.store.CleanOrphanedAnnotationTags(ctx)
	}
	return totalCleanedAnnotations, affected, err
}

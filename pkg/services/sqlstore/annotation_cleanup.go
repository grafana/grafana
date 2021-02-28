package sqlstore

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// AnnotationCleanupService is responsible for cleaning old annotations.
type AnnotationCleanupService struct {
	batchSize int64
	log       log.Logger
}

const (
	alertAnnotationType     = "alert_id <> 0"
	dashboardAnnotationType = "dashboard_id <> 0 AND alert_id = 0"
	apiAnnotationType       = "alert_id = 0 AND dashboard_id = 0"
)

// CleanAnnotations deletes old annotations created by alert rules, API
// requests and human made in the UI. It subsequently deletes orphaned rows
// from the annotation_tag table. Cleanup actions are performed in batches
// so that no query takes too long to complete.
//
// Returns the number of annotation and annotation_tag rows deleted. If an
// error occurs, it returns the number of rows affected so far.
func (acs *AnnotationCleanupService) CleanAnnotations(ctx context.Context, cfg *setting.Cfg) (int64, int64, error) {
	var totalCleanedAnnotations int64
	affected, err := acs.cleanAnnotations(ctx, cfg.AlertingAnnotationCleanupSetting, alertAnnotationType)
	totalCleanedAnnotations += affected
	if err != nil {
		return totalCleanedAnnotations, 0, err
	}

	affected, err = acs.cleanAnnotations(ctx, cfg.APIAnnotationCleanupSettings, apiAnnotationType)
	totalCleanedAnnotations += affected
	if err != nil {
		return totalCleanedAnnotations, 0, err
	}

	affected, err = acs.cleanAnnotations(ctx, cfg.DashboardAnnotationCleanupSettings, dashboardAnnotationType)
	totalCleanedAnnotations += affected
	if err != nil {
		return totalCleanedAnnotations, 0, err
	}

	affected, err = acs.cleanOrphanedAnnotationTags(ctx)
	return totalCleanedAnnotations, affected, err
}

func (acs *AnnotationCleanupService) cleanAnnotations(ctx context.Context, cfg setting.AnnotationCleanupSettings, annotationType string) (int64, error) {
	var totalAffected int64
	if cfg.MaxAge > 0 {
		cutoffDate := time.Now().Add(-cfg.MaxAge).UnixNano() / int64(time.Millisecond)
		deleteQuery := `DELETE FROM annotation WHERE id IN (SELECT id FROM (SELECT id FROM annotation WHERE %s AND created < %v ORDER BY id DESC %s) a)`
		sql := fmt.Sprintf(deleteQuery, annotationType, cutoffDate, dialect.Limit(acs.batchSize))

		affected, err := acs.executeUntilDoneOrCancelled(ctx, sql)
		totalAffected += affected
		if err != nil {
			return totalAffected, err
		}
	}

	if cfg.MaxCount > 0 {
		deleteQuery := `DELETE FROM annotation WHERE id IN (SELECT id FROM (SELECT id FROM annotation WHERE %s ORDER BY id DESC %s) a)`
		sql := fmt.Sprintf(deleteQuery, annotationType, dialect.LimitOffset(acs.batchSize, cfg.MaxCount))
		affected, err := acs.executeUntilDoneOrCancelled(ctx, sql)
		totalAffected += affected
		return totalAffected, err
	}

	return totalAffected, nil
}

func (acs *AnnotationCleanupService) cleanOrphanedAnnotationTags(ctx context.Context) (int64, error) {
	deleteQuery := `DELETE FROM annotation_tag WHERE id IN ( SELECT id FROM (SELECT id FROM annotation_tag WHERE NOT EXISTS (SELECT 1 FROM annotation a WHERE annotation_id = a.id) %s) a)`
	sql := fmt.Sprintf(deleteQuery, dialect.Limit(acs.batchSize))
	return acs.executeUntilDoneOrCancelled(ctx, sql)
}

func (acs *AnnotationCleanupService) executeUntilDoneOrCancelled(ctx context.Context, sql string) (int64, error) {
	var totalAffected int64
	for {
		select {
		case <-ctx.Done():
			return totalAffected, ctx.Err()
		default:
			var affected int64
			err := withDbSession(ctx, func(session *DBSession) error {
				res, err := session.Exec(sql)
				if err != nil {
					return err
				}

				affected, err = res.RowsAffected()
				totalAffected += affected

				return err
			})
			if err != nil {
				return totalAffected, err
			}

			if affected == 0 {
				return totalAffected, nil
			}
		}
	}
}

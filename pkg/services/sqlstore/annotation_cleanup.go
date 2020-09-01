package sqlstore

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// AnnotationCleanupService is responseible for cleaning old annotations.
type AnnotationCleanupService struct {
	batchSize int64
	log       log.Logger
}

const (
	alertAnnotationType     = "alert_id <> 0"
	dashboardAnnotationType = "dashboard_id <> 0 AND alert_id = 0"
	apiAnnotationType       = "alert_id = 0 AND dashboard_id = 0"
)

// CleanAnnotations deletes old annotations created by
// alert rules, API requests and human made in the UI.
func (acs *AnnotationCleanupService) CleanAnnotations(ctx context.Context, cfg *setting.Cfg) error {
	err := acs.cleanAnnotations(ctx, cfg.AlertingAnnotationCleanupSetting, alertAnnotationType)
	if err != nil {
		return err
	}

	err = acs.cleanAnnotations(ctx, cfg.APIAnnotationCleanupSettings, apiAnnotationType)
	if err != nil {
		return err
	}

	return acs.cleanAnnotations(ctx, cfg.DashboardAnnotationCleanupSettings, dashboardAnnotationType)
}

func (acs *AnnotationCleanupService) cleanAnnotations(ctx context.Context, cfg setting.AnnotationCleanupSettings, annotationType string) error {
	if cfg.MaxAge > 0 {
		cutoffDate := time.Now().Add(-cfg.MaxAge).UnixNano() / int64(time.Millisecond)
		deleteQuery := `DELETE FROM annotation WHERE id IN (SELECT id FROM (SELECT id FROM annotation WHERE %s AND created < %v ORDER BY id DESC %s) a)`
		sql := fmt.Sprintf(deleteQuery, annotationType, cutoffDate, dialect.Limit(acs.batchSize))

		err := acs.executeUntilDoneOrCancelled(ctx, sql)
		if err != nil {
			return err
		}
	}

	if cfg.MaxCount > 0 {
		deleteQuery := `DELETE FROM annotation WHERE id IN (SELECT id FROM (SELECT id FROM annotation WHERE %s ORDER BY id DESC %s) a)`
		sql := fmt.Sprintf(deleteQuery, annotationType, dialect.LimitOffset(acs.batchSize, cfg.MaxCount))
		return acs.executeUntilDoneOrCancelled(ctx, sql)
	}

	return nil
}

func (acs *AnnotationCleanupService) executeUntilDoneOrCancelled(ctx context.Context, sql string) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			var affected int64
			err := withDbSession(ctx, func(session *DBSession) error {
				res, err := session.Exec(sql)
				if err != nil {
					return err
				}

				affected, err = res.RowsAffected()

				return err
			})
			if err != nil {
				return err
			}

			if affected == 0 {
				return nil
			}
		}
	}
}

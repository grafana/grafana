package sqlstore

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

type AnnotationCleanupService struct {
	BatchSize int64
	log       log.Logger
	SQLStore  *SqlStore
}

var (
	AlertAnnotationType     = "alert_id <> 0"
	DashboardAnnotationType = "dashboard_id <> 0 AND alert_id = 0"
	APIAnnotationType       = "alert_id = 0 AND dashboard_id = 0"
)

func (acs *AnnotationCleanupService) clean(ctx context.Context, cfg setting.AnnotationCleanupSettings, sql string) error {
	if cfg.MaxAge > 0 {
		err := acs.cleanBasedOnMaxAge(ctx, sql, cfg.MaxAge)
		if err != nil {
			return err
		}
	}

	if cfg.MaxCount > 0 {
		return acs.cleanBasedOnMaxCount(ctx, sql, cfg.MaxCount)
	}

	return nil
}

func (acs *AnnotationCleanupService) cleanBasedOnMaxAge(ctx context.Context, annotationType string, maxAge time.Duration) error {
	cutoffDate := time.Now().Add(-maxAge).UnixNano() / int64(time.Millisecond)
	deleteQuery := `DELETE FROM annotation WHERE id IN (SELECT id FROM annotation WHERE %s AND created < %v ORDER BY id DESC LIMIT %v)`

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			var affected int64
			acs.SQLStore.WithDbSession(ctx, func(session *DBSession) error {
				sql := fmt.Sprintf(deleteQuery, annotationType, cutoffDate, acs.BatchSize)
				res, err := session.Exec(sql)
				if err != nil {
					return err
				}

				affected, err = res.RowsAffected()

				return err
			})

			if affected == 0 {
				return nil
			}
		}
	}
}

func (acs *AnnotationCleanupService) cleanBasedOnMaxCount(ctx context.Context, annotationType string, maxCount int64) error {
	deleteQuery := `DELETE FROM annotation WHERE id IN (SELECT ID FROM (SELECT id FROM annotation WHERE %s ORDER BY id LIMIT %v, %v) a)`

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			var affected int64
			acs.SQLStore.WithDbSession(ctx, func(session *DBSession) error {
				sql := fmt.Sprintf(deleteQuery, annotationType, maxCount, acs.BatchSize)
				res, err := session.Exec(sql)
				if err != nil {
					return err
				}

				affected, err = res.RowsAffected()

				return err
			})

			if affected == 0 {
				return nil
			}
		}
	}
}

func (acs *AnnotationCleanupService) CleanAnnotations(ctx context.Context, cfg *setting.Cfg) error {
	err := acs.clean(ctx, cfg.AlertingAnnotationCleanupSetting, AlertAnnotationType)
	if err != nil {
		return err
	}

	err = acs.clean(ctx, cfg.APIAnnotationCleanupSettings, APIAnnotationType)
	if err != nil {
		return err
	}

	return acs.clean(ctx, cfg.DashboardAnnotationCleanupSettings, DashboardAnnotationType)
}

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
}

func (acs *AnnotationCleanupService) cleanBasedOnMaxAge(ctx context.Context, annotationType string, maxAge time.Duration) error {
	deleteQuery := `DELETE FROM annotation WHERE id IN (SELECT id FROM annotation WHERE ? AND created < ? ORDER BY id DESC LIMIT ?)`
	cutoffDate := time.Now().Add(-maxAge).UnixNano() / int64(time.Millisecond)
	fmt.Println("sql: ", deleteQuery)
	fmt.Println("annotationtype: ", annotationType)
	fmt.Println("cutoffDate: ", cutoffDate)
	fmt.Println("batch: ", acs.BatchSize)

	err := withDbSession(ctx, func(session *DBSession) error {
		res, err := session.Exec(deleteQuery, annotationType, cutoffDate, acs.BatchSize)
		if err != nil {
			return err
		}

		affected, err := res.RowsAffected()
		fmt.Println("Affected: ", affected)
		fmt.Println("Affected: ", affected)

		return err
	})

	return err
}

func (acs *AnnotationCleanupService) clean(ctx context.Context, cfg setting.AnnotationCleanupSettings, sql string) error {
	if cfg.MaxAge > 0 {
		err := acs.cleanBasedOnMaxAge(ctx, sql, cfg.MaxAge)
		if err != nil {
			return err
		}
	}

	return nil
}

func (acs *AnnotationCleanupService) CleanAnnotations(ctx context.Context, cfg *setting.Cfg) error {
	err := acs.clean(ctx, cfg.AlertingAnnotationCleanupSetting, "alert_id <> 0")
	if err != nil {
		return err
	}

	err = acs.clean(ctx, cfg.APIAnnotationCleanupSettings, "alert_id = 0 AND dashboard_id = 0")
	if err != nil {
		return err
	}

	return acs.clean(ctx, cfg.DashboardAnnotationCleanupSettings, "dashboard_id <> 0 AND alert_id = 0")
	/*
		DELETE FROM annotation WHERE id IN (SELECT id FROM annotation WHERE type = 'test' ORDER BY id DESC LIMIT 30, 60)

		DELETE FROM table
			WHERE ID IN
					(
					SELECT ID
					FROM
						(
							SELECT ID
							FROM table
							WHERE Type = 'TEST'
							ORDER BY ID
							LIMIT 30,60
						) a
					)
	*/
}

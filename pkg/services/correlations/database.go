package correlations

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/util"
)

const VALID_TYPE_FILTER = "(correlation.type = 'external' OR (correlation.type = 'query' AND dst.uid IS NOT NULL))"

// createCorrelation adds a correlation
func (s CorrelationsService) createCorrelation(ctx context.Context, cmd CreateCorrelationCommand) (Correlation, error) {
	correlation := Correlation{
		UID:         util.GenerateShortUID(),
		OrgID:       cmd.OrgId,
		SourceUID:   cmd.SourceUID,
		TargetUID:   cmd.TargetUID,
		Label:       cmd.Label,
		Description: cmd.Description,
		Config:      cmd.Config,
		Provisioned: cmd.Provisioned,
		Type:        cmd.Type,
	}

	if correlation.Config.Type == CorrelationType("query") {
		correlation.Type = CorrelationType("query")
	} else if correlation.Config.Type != "" {
		return correlation, ErrConfigTypeDeprecated
	}

	err := s.SQLStore.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		var err error

		query := &datasources.GetDataSourceQuery{
			OrgID: cmd.OrgId,
			UID:   cmd.SourceUID,
		}
		_, err = s.DataSourceService.GetDataSource(ctx, query)
		if err != nil {
			return ErrSourceDataSourceDoesNotExists
		}

		if cmd.TargetUID != nil {
			if _, err = s.DataSourceService.GetDataSource(ctx, &datasources.GetDataSourceQuery{
				OrgID: cmd.OrgId,
				UID:   *cmd.TargetUID,
			}); err != nil {
				return ErrTargetDataSourceDoesNotExists
			}
		}

		_, err = session.Omit("source_type", "target_type").Insert(correlation)
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return Correlation{}, err
	}

	return correlation, nil
}

/*
if this is ran from legacy, we will get a sourceUID directly. check the datasource exists first before checking the correlation for validity

if it is ran from app platform (via dualWriteMode allowing edits to legacy), we will not get a sourceUID passed.
check the correlation, then use the SourceUID from that to check the datasource for validity

ideally we want the datasource to be checked first as much as possible
*/
func (s CorrelationsService) deleteCorrelation(ctx context.Context, cmd DeleteCorrelationCommand) error {
	return s.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
		var foundSourceUID string
		var foundCorrelation Correlation

		// if sourceUID is not passed, find it from the correlation and mark the correlation as found so we don't requery
		if cmd.SourceUID == "" {
			correlation, err := s.GetCorrelation(ctx, GetCorrelationQuery(cmd))
			if err != nil {
				return err
			}

			if correlation.Provisioned {
				return ErrCorrelationReadOnly
			}
			foundSourceUID = correlation.SourceUID
			foundCorrelation = correlation
		} else {
			foundSourceUID = cmd.SourceUID
		}

		if foundSourceUID == "" {
			return ErrSourceDataSourceDoesNotExists
		}

		query := &datasources.GetDataSourceQuery{
			OrgID: cmd.OrgId,
			UID:   foundSourceUID,
		}
		_, err := s.DataSourceService.GetDataSource(ctx, query)
		if err != nil {
			return ErrSourceDataSourceDoesNotExists
		}

		if foundCorrelation.UID == "" {
			correlation, err := s.GetCorrelation(ctx, GetCorrelationQuery(cmd))

			if err != nil {
				return err
			}

			if correlation.Provisioned {
				return ErrCorrelationReadOnly
			}

			foundSourceUID = cmd.SourceUID
		}

		deletedCount, err := session.Delete(&Correlation{UID: cmd.UID, SourceUID: foundSourceUID})

		if err != nil {
			return err
		}

		if deletedCount == 0 {
			return ErrCorrelationNotFound
		}

		return nil
	})
}

func (s CorrelationsService) updateCorrelation(ctx context.Context, cmd UpdateCorrelationCommand) (Correlation, error) {
	correlation := Correlation{
		UID:       cmd.UID,
		SourceUID: cmd.SourceUID,
		OrgID:     cmd.OrgId,
	}

	err := s.SQLStore.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		var foundSourceUID string
		var foundCorrelation Correlation

		// for app platform handling where we don't have a source datasource UID, skipped if from legacy API
		if cmd.SourceUID == "" {
			uidOnlyCorr, err := s.GetCorrelation(ctx, GetCorrelationQuery{UID: cmd.UID, OrgId: cmd.OrgId})

			if err != nil {
				return err
			}

			if uidOnlyCorr.Provisioned {
				return ErrCorrelationReadOnly
			}
			foundSourceUID = uidOnlyCorr.SourceUID
			foundCorrelation = uidOnlyCorr
			correlation.SourceUID = uidOnlyCorr.SourceUID
		} else {
			foundSourceUID = cmd.SourceUID
		}

		if foundSourceUID == "" {
			return ErrSourceDataSourceDoesNotExists
		}

		// used by both legacy and app platform API
		query := &datasources.GetDataSourceQuery{
			OrgID: cmd.OrgId,
			UID:   foundSourceUID,
		}
		_, err := s.DataSourceService.GetDataSource(ctx, query)
		if err != nil {
			return ErrSourceDataSourceDoesNotExists
		}

		// for legacy API handling, skipped if from app platform API
		if foundCorrelation.UID == "" {
			foundCorrelation, err := session.Omit("source_type", "target_type").Get(&correlation)
			if err != nil {
				return err
			}
			if !foundCorrelation {
				return ErrCorrelationNotFound
			}
			if correlation.Provisioned {
				return ErrCorrelationReadOnly
			}
		}

		if cmd.Label != nil {
			correlation.Label = *cmd.Label
			session.MustCols("label")
		}
		if cmd.Description != nil {
			correlation.Description = *cmd.Description
			session.MustCols("description")
		}
		if cmd.Type != nil {
			correlation.Type = *cmd.Type
		}
		if cmd.Config != nil {
			session.MustCols("config")
			if cmd.Config.Field != nil {
				correlation.Config.Field = *cmd.Config.Field
			}
			if cmd.Config.Target != nil {
				correlation.Config.Target = *cmd.Config.Target
			}
			if cmd.Config.Transformations != nil {
				correlation.Config.Transformations = cmd.Config.Transformations
			}
		}

		updateCount, err := session.
			Where("uid = ? AND source_uid = ?", correlation.UID, correlation.SourceUID).
			Limit(1).
			Omit("source_type", "target_type").
			Update(correlation)

		if err != nil {
			return err
		}

		if updateCount == 0 {
			return ErrCorrelationNotFound
		}

		return nil
	})

	if err != nil {
		return Correlation{}, err
	}

	return correlation, nil
}

func (s CorrelationsService) getCorrelation(ctx context.Context, cmd GetCorrelationQuery) (Correlation, error) {
	correlation := Correlation{
		UID:       cmd.UID,
		OrgID:     cmd.OrgId,
		SourceUID: cmd.SourceUID,
	}

	if cmd.SourceUID != "" {
		if _, err := s.DataSourceService.GetDataSource(ctx, &datasources.GetDataSourceQuery{
			UID:   correlation.SourceUID,
			OrgID: cmd.OrgId,
		}); err != nil {
			return Correlation{}, ErrSourceDataSourceDoesNotExists
		}
	}

	err := s.SQLStore.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		sql := session.Select("correlation.*, dss.type as source_type, dst.type as target_type").
			Join("", "data_source AS dss", "correlation.source_uid = dss.uid and dss.org_id = correlation.org_id and dss.org_id = ?", cmd.OrgId).
			Join("LEFT OUTER", "data_source AS dst", "correlation.target_uid = dst.uid and dst.org_id = ?", cmd.OrgId).
			Where("correlation.uid = ?", correlation.UID).
			And("correlation.org_id = ?", correlation.OrgID).
			And(VALID_TYPE_FILTER)
		if correlation.SourceUID != "" {
			sql = sql.And("correlation.source_uid = ?", correlation.SourceUID)
		}
		found, err := sql.Get(&correlation)
		if !found {
			return ErrCorrelationNotFound
		}
		return err
	})

	if err != nil {
		return Correlation{}, err
	}

	return correlation, nil
}

func (s CorrelationsService) CountCorrelations(ctx context.Context) (*quota.Map, error) {
	u := &quota.Map{}
	var err error
	count := int64(0)
	err = s.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		q := sess.Table("correlation")
		count, err = q.Count()

		if err != nil {
			return err
		}

		tag, err := quota.NewTag(QuotaTargetSrv, QuotaTarget, quota.GlobalScope)
		if err != nil {
			return err
		}
		u.Set(tag, count)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return u, err
}

func (s CorrelationsService) getCorrelationsBySourceUID(ctx context.Context, cmd GetCorrelationsBySourceUIDQuery) ([]Correlation, error) {
	correlations := make([]Correlation, 0)

	err := s.SQLStore.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		query := &datasources.GetDataSourceQuery{
			OrgID: cmd.OrgId,
			UID:   cmd.SourceUID,
		}
		if _, err := s.DataSourceService.GetDataSource(ctx, query); err != nil {
			return ErrSourceDataSourceDoesNotExists
		}
		return session.Select("correlation.*").Join("", "data_source AS dss", "correlation.source_uid = dss.uid and dss.org_id = correlation.org_id and dss.org_id = ?", cmd.OrgId).Join("LEFT OUTER", "data_source AS dst", "correlation.target_uid = dst.uid and dst.org_id = ?", cmd.OrgId).Where("correlation.source_uid = ?", cmd.SourceUID).And(VALID_TYPE_FILTER).Find(&correlations)
	})

	if err != nil {
		return []Correlation{}, err
	}

	return correlations, nil
}

func (s CorrelationsService) getCorrelations(ctx context.Context, cmd GetCorrelationsQuery) (GetCorrelationsResponseBody, error) {
	result := GetCorrelationsResponseBody{
		Correlations: make([]Correlation, 0),
		Page:         cmd.Page,
		Limit:        cmd.Limit,
	}

	err := s.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
		offset := cmd.Limit * (cmd.Page - 1)

		q := session.Select("correlation.*, dss.type as source_type, dst.type as target_type").
			Join("", "data_source AS dss", "correlation.source_uid = dss.uid and dss.org_id = correlation.org_id and dss.org_id = ? ", cmd.OrgId).
			Join("LEFT OUTER", "data_source AS dst", "correlation.target_uid = dst.uid and dst.org_id = ?", cmd.OrgId)

		if len(cmd.SourceUIDs) > 0 {
			q.In("dss.uid", cmd.SourceUIDs)
		}

		q.Where(VALID_TYPE_FILTER)

		return q.Limit(int(cmd.Limit), int(offset)).Find(&result.Correlations)
	})
	if err != nil {
		return GetCorrelationsResponseBody{}, err
	}

	count, err := s.CountCorrelations(ctx)
	if err != nil {
		return GetCorrelationsResponseBody{}, err
	}

	tag, err := quota.NewTag(QuotaTargetSrv, QuotaTarget, quota.GlobalScope)
	if err != nil {
		return GetCorrelationsResponseBody{}, err
	}

	totalCount, _ := count.Get(tag)
	result.TotalCount = totalCount

	return result, nil
}

func (s CorrelationsService) deleteCorrelationsBySourceUID(ctx context.Context, cmd DeleteCorrelationsBySourceUIDCommand) error {
	return s.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
		db := session.Where("source_uid = ? and org_id = ?", cmd.SourceUID, cmd.OrgId)
		if cmd.OnlyProvisioned {
			// bool in a struct needs to be in Where
			// https://github.com/go-xorm/xorm/blob/v0.7.9/engine_cond.go#L102
			db = db.And("provisioned = ?", true)
		}
		_, err := db.Delete(&Correlation{})
		return err
	})
}

func (s CorrelationsService) deleteCorrelationsByTargetUID(ctx context.Context, cmd DeleteCorrelationsByTargetUIDCommand) error {
	return s.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
		_, err := session.Where("source_uid = ? and org_id = ?", cmd.TargetUID, cmd.OrgId).Delete(&Correlation{})
		return err
	})
}

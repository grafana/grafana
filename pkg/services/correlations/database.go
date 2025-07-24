package correlations

import (
	"context"

	"github.com/grafana/grafana/pkg/util/xorm/core"

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
		return correlation, ErrInvalidConfigType
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

		_, err = session.Insert(correlation)
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

func (s CorrelationsService) deleteCorrelation(ctx context.Context, cmd DeleteCorrelationCommand) error {
	return s.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
		query := &datasources.GetDataSourceQuery{
			OrgID: cmd.OrgId,
			UID:   cmd.SourceUID,
		}
		_, err := s.DataSourceService.GetDataSource(ctx, query)
		if err != nil {
			return ErrSourceDataSourceDoesNotExists
		}

		correlation, err := s.GetCorrelation(ctx, GetCorrelationQuery(cmd))

		if err != nil {
			return err
		}

		if correlation.Provisioned {
			return ErrCorrelationReadOnly
		}

		deletedCount, err := session.Delete(&Correlation{UID: cmd.UID, SourceUID: cmd.SourceUID})

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
		query := &datasources.GetDataSourceQuery{
			OrgID: cmd.OrgId,
			UID:   cmd.SourceUID,
		}
		_, err := s.DataSourceService.GetDataSource(ctx, query)
		if err != nil {
			return ErrSourceDataSourceDoesNotExists
		}

		found, err := session.Get(&correlation)
		if !found {
			return ErrCorrelationNotFound
		}
		if err != nil {
			return err
		}
		if correlation.Provisioned {
			return ErrCorrelationReadOnly
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

		updateCount, err := session.Where("uid = ? AND source_uid = ?", correlation.UID, correlation.SourceUID).Limit(1).Update(correlation)

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
		SourceUID: cmd.SourceUID,
	}

	err := s.SQLStore.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		query := &datasources.GetDataSourceQuery{
			OrgID: cmd.OrgId,
			UID:   cmd.SourceUID,
		}
		if _, err := s.DataSourceService.GetDataSource(ctx, query); err != nil {
			return ErrSourceDataSourceDoesNotExists
		}

		// Correlations created before the fix #72498 may have org_id = 0, but it's deprecated and will be removed in #72325
		found, err := session.Select("correlation.*").Join("", "data_source AS dss", "correlation.source_uid = dss.uid and (correlation.org_id = 0 or dss.org_id = correlation.org_id) and dss.org_id = ?", cmd.OrgId).Join("LEFT OUTER", "data_source AS dst", "correlation.target_uid = dst.uid and dst.org_id = ?", cmd.OrgId).Where("correlation.uid = ?", correlation.UID).And("correlation.source_uid = ?", correlation.SourceUID).And(VALID_TYPE_FILTER).Get(&correlation)
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
		// Correlations created before the fix #72498 may have org_id = 0, but it's deprecated and will be removed in #72325
		return session.Select("correlation.*").Join("", "data_source AS dss", "correlation.source_uid = dss.uid and (correlation.org_id = 0 or dss.org_id = correlation.org_id) and dss.org_id = ?", cmd.OrgId).Join("LEFT OUTER", "data_source AS dst", "correlation.target_uid = dst.uid and dst.org_id = ?", cmd.OrgId).Where("correlation.source_uid = ?", cmd.SourceUID).And(VALID_TYPE_FILTER).Find(&correlations)
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

		// Correlations created before the fix #72498 may have org_id = 0, but it's deprecated and will be removed in #72325
		q := session.Select("correlation.*").Join("", "data_source AS dss", "correlation.source_uid = dss.uid and (correlation.org_id = 0 or dss.org_id = correlation.org_id) and dss.org_id = ? ", cmd.OrgId).Join("LEFT OUTER", "data_source AS dst", "correlation.target_uid = dst.uid and dst.org_id = ?", cmd.OrgId)

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
		// Correlations created before the fix #72498 may have org_id = 0, but it's deprecated and will be removed in #72325
		db := session.Where("source_uid = ? and (org_id = ? or org_id = 0)", cmd.SourceUID, cmd.OrgId)
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
		// Correlations created before the fix #72498 may have org_id = 0, but it's deprecated and will be removed in #72325
		_, err := session.Where("source_uid = ? and (org_id = ? or org_id = 0)", cmd.TargetUID, cmd.OrgId).Delete(&Correlation{})
		return err
	})
}

// internal use: It's require only for correct migration of existing records. Can be removed in Grafana 11.
func (s CorrelationsService) createOrUpdateCorrelation(ctx context.Context, cmd CreateCorrelationCommand) error {
	correlation := Correlation{
		SourceUID:   cmd.SourceUID,
		OrgID:       cmd.OrgId,
		TargetUID:   cmd.TargetUID,
		Label:       cmd.Label,
		Description: cmd.Description,
		Config:      cmd.Config,
		Provisioned: false,
		Type:        cmd.Type,
	}

	found := false
	err := s.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
		has, err := session.Get(&correlation)
		found = has
		return err
	})

	if err != nil {
		return err
	}

	if found && cmd.Provisioned {
		correlation.Provisioned = true
		return s.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
			_, err := session.ID(core.NewPK(correlation.UID, correlation.SourceUID, correlation.OrgID)).Cols("provisioned").Update(&correlation)
			return err
		})
	} else {
		_, err := s.createCorrelation(ctx, cmd)
		return err
	}
}

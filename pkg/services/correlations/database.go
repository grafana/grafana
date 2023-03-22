package correlations

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/util"
)

// createCorrelation adds a correlation
func (s CorrelationsService) createCorrelation(ctx context.Context, cmd CreateCorrelationCommand) (Correlation, error) {
	correlation := Correlation{
		UID:         util.GenerateShortUID(),
		SourceUID:   cmd.SourceUID,
		TargetUID:   cmd.TargetUID,
		Label:       cmd.Label,
		Description: cmd.Description,
		Config:      cmd.Config,
	}

	err := s.SQLStore.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		var err error

		query := &datasources.GetDataSourceQuery{
			OrgID: cmd.OrgId,
			UID:   cmd.SourceUID,
		}
		dataSource, err := s.DataSourceService.GetDataSource(ctx, query)
		if err != nil {
			return ErrSourceDataSourceDoesNotExists
		}

		if !cmd.SkipReadOnlyCheck && dataSource.ReadOnly {
			return ErrSourceDataSourceReadOnly
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
		dataSource, err := s.DataSourceService.GetDataSource(ctx, query)
		if err != nil {
			return ErrSourceDataSourceDoesNotExists
		}

		if dataSource.ReadOnly {
			return ErrSourceDataSourceReadOnly
		}

		deletedCount, err := session.Delete(&Correlation{UID: cmd.UID, SourceUID: cmd.SourceUID})
		if deletedCount == 0 {
			return ErrCorrelationNotFound
		}
		return err
	})
}

func (s CorrelationsService) updateCorrelation(ctx context.Context, cmd UpdateCorrelationCommand) (Correlation, error) {
	correlation := Correlation{
		UID:       cmd.UID,
		SourceUID: cmd.SourceUID,
	}

	err := s.SQLStore.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		query := &datasources.GetDataSourceQuery{
			OrgID: cmd.OrgId,
			UID:   cmd.SourceUID,
		}
		dataSource, err := s.DataSourceService.GetDataSource(ctx, query)
		if err != nil {
			return ErrSourceDataSourceDoesNotExists
		}

		if dataSource.ReadOnly {
			return ErrSourceDataSourceReadOnly
		}

		found, err := session.Get(&correlation)
		if !found {
			return ErrCorrelationNotFound
		}
		if err != nil {
			return err
		}

		if cmd.Label != nil {
			correlation.Label = *cmd.Label
			session.MustCols("label")
		}
		if cmd.Description != nil {
			correlation.Description = *cmd.Description
			session.MustCols("description")
		}
		if cmd.Config != nil {
			session.MustCols("config")
			if cmd.Config.Field != nil {
				correlation.Config.Field = *cmd.Config.Field
			}
			if cmd.Config.Type != nil {
				correlation.Config.Type = *cmd.Config.Type
			}
			if cmd.Config.Target != nil {
				correlation.Config.Target = *cmd.Config.Target
			}
			if cmd.Config.Transformations != nil {
				correlation.Config.Transformations = cmd.Config.Transformations
			}
		}

		updateCount, err := session.Where("uid = ? AND source_uid = ?", correlation.UID, correlation.SourceUID).Limit(1).Update(correlation)
		if updateCount == 0 {
			return ErrCorrelationNotFound
		}
		return err
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

		found, err := session.Select("correlation.*").Join("", "data_source AS dss", "correlation.source_uid = dss.uid and dss.org_id = ?", cmd.OrgId).Join("", "data_source AS dst", "correlation.target_uid = dst.uid and dst.org_id = ?", cmd.OrgId).Where("correlation.uid = ? AND correlation.source_uid = ?", correlation.UID, correlation.SourceUID).Get(&correlation)
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

		return session.Select("correlation.*").Join("", "data_source AS dss", "correlation.source_uid = dss.uid and dss.org_id = ?", cmd.OrgId).Join("", "data_source AS dst", "correlation.target_uid = dst.uid and dst.org_id = ?", cmd.OrgId).Where("correlation.source_uid = ?", cmd.SourceUID).Find(&correlations)
	})

	if err != nil {
		return []Correlation{}, err
	}

	return correlations, nil
}

func (s CorrelationsService) getCorrelations(ctx context.Context, cmd GetCorrelationsQuery) ([]Correlation, error) {
	correlations := make([]Correlation, 0)

	err := s.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
		offset := cmd.Limit * (cmd.Page - 1)

		return session.Select("correlation.*").Join("", "data_source AS dss", "correlation.source_uid = dss.uid and dss.org_id = ?", cmd.OrgId).Join("", "data_source AS dst", "correlation.target_uid = dst.uid and dst.org_id = ?", cmd.OrgId).Limit(int(cmd.Limit), int(offset)).Find(&correlations)
	})
	if err != nil {
		return []Correlation{}, err
	}

	return correlations, nil
}

func (s CorrelationsService) deleteCorrelationsBySourceUID(ctx context.Context, cmd DeleteCorrelationsBySourceUIDCommand) error {
	return s.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
		_, err := session.Delete(&Correlation{SourceUID: cmd.SourceUID})
		return err
	})
}

func (s CorrelationsService) deleteCorrelationsByTargetUID(ctx context.Context, cmd DeleteCorrelationsByTargetUIDCommand) error {
	return s.SQLStore.WithDbSession(ctx, func(session *db.Session) error {
		_, err := session.Delete(&Correlation{TargetUID: &cmd.TargetUID})
		return err
	})
}

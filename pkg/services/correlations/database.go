package correlations

import (
	"context"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/sqlstore"
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
	}

	err := s.SQLStore.WithTransactionalDbSession(ctx, func(session *sqlstore.DBSession) error {
		var err error

		query := &datasources.GetDataSourceQuery{
			OrgId: cmd.OrgId,
			Uid:   cmd.SourceUID,
		}
		if err = s.DataSourceService.GetDataSource(ctx, query); err != nil {
			return ErrSourceDataSourceDoesNotExists
		}

		if !cmd.SkipReadOnlyCheck && query.Result.ReadOnly {
			return ErrSourceDataSourceReadOnly
		}

		if err = s.DataSourceService.GetDataSource(ctx, &datasources.GetDataSourceQuery{
			OrgId: cmd.OrgId,
			Uid:   cmd.TargetUID,
		}); err != nil {
			return ErrTargetDataSourceDoesNotExists
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
	return s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		query := &datasources.GetDataSourceQuery{
			OrgId: cmd.OrgId,
			Uid:   cmd.SourceUID,
		}
		if err := s.DataSourceService.GetDataSource(ctx, query); err != nil {
			return ErrSourceDataSourceDoesNotExists
		}

		if query.Result.ReadOnly {
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

	err := s.SQLStore.WithTransactionalDbSession(ctx, func(session *sqlstore.DBSession) error {
		query := &datasources.GetDataSourceQuery{
			OrgId: cmd.OrgId,
			Uid:   cmd.SourceUID,
		}
		if err := s.DataSourceService.GetDataSource(ctx, query); err != nil {
			return ErrSourceDataSourceDoesNotExists
		}

		if query.Result.ReadOnly {
			return ErrSourceDataSourceReadOnly
		}

		if cmd.Label == nil && cmd.Description == nil {
			return ErrUpdateCorrelationEmptyParams
		}
		update := Correlation{}
		if cmd.Label != nil {
			update.Label = *cmd.Label
			session.MustCols("label")
		}
		if cmd.Description != nil {
			update.Description = *cmd.Description
			session.MustCols("description")
		}

		updateCount, err := session.Where("uid = ? AND source_uid = ?", correlation.UID, correlation.SourceUID).Limit(1).Update(update)
		if updateCount == 0 {
			return ErrCorrelationNotFound
		}
		if err != nil {
			return err
		}

		found, err := session.Get(&correlation)
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

func (s CorrelationsService) getCorrelation(ctx context.Context, cmd GetCorrelationQuery) (Correlation, error) {
	correlation := Correlation{
		UID:       cmd.UID,
		SourceUID: cmd.SourceUID,
	}

	err := s.SQLStore.WithTransactionalDbSession(ctx, func(session *sqlstore.DBSession) error {
		query := &datasources.GetDataSourceQuery{
			OrgId: cmd.OrgId,
			Uid:   cmd.SourceUID,
		}
		if err := s.DataSourceService.GetDataSource(ctx, query); err != nil {
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

func (s CorrelationsService) getCorrelationsBySourceUID(ctx context.Context, cmd GetCorrelationsBySourceUIDQuery) ([]Correlation, error) {
	correlations := make([]Correlation, 0)

	err := s.SQLStore.WithTransactionalDbSession(ctx, func(session *sqlstore.DBSession) error {
		query := &datasources.GetDataSourceQuery{
			OrgId: cmd.OrgId,
			Uid:   cmd.SourceUID,
		}
		if err := s.DataSourceService.GetDataSource(ctx, query); err != nil {
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

	err := s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		return session.Select("correlation.*").Join("", "data_source AS dss", "correlation.source_uid = dss.uid and dss.org_id = ?", cmd.OrgId).Join("", "data_source AS dst", "correlation.target_uid = dst.uid and dst.org_id = ?", cmd.OrgId).Find(&correlations)
	})
	if err != nil {
		return []Correlation{}, err
	}

	return correlations, nil
}

func (s CorrelationsService) deleteCorrelationsBySourceUID(ctx context.Context, cmd DeleteCorrelationsBySourceUIDCommand) error {
	return s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		_, err := session.Delete(&Correlation{SourceUID: cmd.SourceUID})
		return err
	})
}

func (s CorrelationsService) deleteCorrelationsByTargetUID(ctx context.Context, cmd DeleteCorrelationsByTargetUIDCommand) error {
	return s.SQLStore.WithDbSession(ctx, func(session *sqlstore.DBSession) error {
		_, err := session.Delete(&Correlation{TargetUID: cmd.TargetUID})
		return err
	})
}

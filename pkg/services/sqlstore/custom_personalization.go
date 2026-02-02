package sqlstore

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) GetDashPersonalization(ctx context.Context, query *models.GetCustomDashPersonalization) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		result := &models.CustomDashPersonalization{}
		if _, err := dbSession.Table("custom_personalization").
			Where("org_id = ?", query.OrgID).
			Where("user_id = ?", query.UserID).
			Where("dash_uid = ?", query.DashUID).
			Limit(1).
			Get(result); err != nil {
			return err
		}
		query.Result = result
		return nil
	})
}

func (ss *SQLStore) SaveDashPersonalization(ctx context.Context, query *models.SaveCustomDashPersonalization) error {
	return ss.WithTransactionalDbSession(ctx, func(dbSess *DBSession) error {
		findQuery := &models.GetCustomDashPersonalization{
			OrgID:   query.OrgID,
			UserID:  query.UserID,
			DashUID: query.DashUID,
		}
		if err := ss.GetDashPersonalization(ctx, findQuery); err != nil {
			return err
		}
		sess := dbSess.Table("custom_personalization")
		if findQuery.Result.ID == 0 {
			_, err := sess.Insert(query)
			return err
		} else {
			_, err := sess.Cols("data").
				Where("org_id = ?", query.OrgID).
				Where("user_id = ?", query.UserID).
				Where("dash_uid = ?", query.DashUID).
				Update(query)
			return err
		}
	})
}

func (ss *SQLStore) DeleteDashPersonalization(ctx context.Context, query *models.DeleteCustomDashPersonalization) error {
	return ss.WithTransactionalDbSession(ctx, func(dbSess *DBSession) error {
		deleteQuery := &models.DeleteCustomDashPersonalization{
			OrgID:   query.OrgID,
			UserID:  query.UserID,
			DashUID: query.DashUID,
		}
		_, err := dbSess.Table("custom_personalization").
			Where("org_id = ?", deleteQuery.OrgID).
			Where("user_id = ?", deleteQuery.UserID).
			Where("dash_uid = ?", deleteQuery.DashUID).
			Delete(&models.CustomDashPersonalization{})
		return err
	})
}

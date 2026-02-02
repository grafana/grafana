/*
 * Copyright (C) 2022-2025 BMC Helix Inc
 * Added by ymulthan at 4/12/2022
 */

package sqlstore

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) GetFeatureStatus(ctx context.Context, query *models.GetFeatureStatus) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		result := make([]*models.FeatureStatus, 0)
		sess := dbSession.Table("feature_status")
		rawSql := "select t1.* from feature_status as t1"
		rawSql += fmt.Sprintf(" WHERE t1.org_id in (1, %d)", query.OrgId)

		if err := sess.SQL(rawSql).Find(&result); err != nil {
			return err
		}
		query.Result = result
		return nil
	})

}

func (ss *SQLStore) SetFeatureStatus(ctx context.Context, query *models.SetFeatureStatus) error {
	return ss.WithTransactionalDbSession(ctx, func(dbsession *DBSession) error {
		result := &models.FeatureStatus{}
		if has, err := dbsession.Table("feature_status").
			Where("feature_status.org_id = ?", query.OrgId).
			Where("feature_status.feature_name = ?", query.Data.FeatureName).
			Get(result); err != nil {
			return err
		} else {
			if !has {
				if has, err := dbsession.Table("feature_status").
					Where("feature_status.feature_name = ?", query.Data.FeatureName).
					Get(result); err != nil {
					return err
				} else {
					if has {
						if err := insertFeature(dbsession, query); err != nil {
							return err
						}
					}
				}
			} else {
				if err := updateFeature(dbsession, query); err != nil {
					return err
				}
			}
		}
		return nil
	})
}

func insertFeature(sess *DBSession, query *models.SetFeatureStatus) error {
	query.Data.OrgId = query.OrgId
	_, err := sess.Table("feature_status").
		Insert(query.Data)
	if err != nil {
		return err
	}
	return nil
}

func updateFeature(sess *DBSession, query *models.SetFeatureStatus) error {
	session := sess.Table("feature_status")
	rawSql := fmt.Sprintf(`update feature_status SET status=%t where org_id=%d and feature_name='%s'`,
		query.Data.Status, query.OrgId, query.Data.FeatureName)
	if _, err := session.Exec(rawSql); err != nil {
		return err
	}
	return nil
}

func (ss *SQLStore) IsFeatureEnabled(ctx context.Context, orgId int64, featureName string) bool {
	result := ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		result := &models.FeatureStatus{}
		if has, err := dbSession.Table("feature_status").
			Where("feature_status.org_id = ?", orgId).
			Where("feature_status.feature_name = ?", featureName).
			Get(result); err != nil {
			return fmt.Errorf("Failed to query feature status")
		} else {
			if !has {
				// Get Default status of feature (from Main org)
				if has, err := dbSession.Table("feature_status").
					Where("feature_status.org_id = 1").
					Where("feature_status.feature_name = ?", featureName).
					Get(result); err != nil {
					return fmt.Errorf("Failed to query feature status")
				} else {
					if !has {
						return fmt.Errorf("Failed to query feature status")
					} else {
						if result.Status {
							return nil
						}
						return fmt.Errorf("Feature status is false")
					}
				}
			} else {
				if result.Status {
					return nil
				}
				return fmt.Errorf("Feature status is false")
			}
		}
	})

	return result == nil

}

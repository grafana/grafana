/*
 * Copyright (C) 2021-2025 BMC Helix Inc
 * Added by kmejdi at 29/7/2021
 */

package sqlstore

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

func (ss *SQLStore) GetCustomConfiguration(ctx context.Context, query *models.GetCustomConfiguration) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		result := &models.CustomConfiguration{}
		if has, err := dbSession.Table("configuration").
			Where("configuration.org_id = ?", query.OrgId).
			Get(result); err != nil {
			return err
		} else {
			if !has {
				if _, err := dbSession.Table("configuration").
					Where("configuration.org_id = 1").
					Get(result); err != nil {
					return err
				}
			}
		}
		query.Result = result
		return nil
	})
}

func (ss *SQLStore) SetCustomConfiguration(ctx context.Context, query *models.SetCustomConfiguration) error {

	return ss.WithTransactionalDbSession(ctx, func(dbsession *DBSession) error {
		result := &models.CustomConfiguration{}
		if has, err := dbsession.Table("configuration").
			Where("configuration.org_id = ?", query.OrgId).
			Get(result); err != nil {
			return err
		} else {
			if !has {
				if err := ss.insertConfiguration(dbsession, query); err != nil {
					return err
				}
			} else {
				if err := ss.updateConfiguration(dbsession, query); err != nil {
					return err
				}
			}
		}
		return nil
	})
}

func (ss *SQLStore) ResetCustomConfiguration(ctx context.Context, query *models.RefreshCustomConfiguration) error {
	return ss.WithTransactionalDbSession(ctx, func(dbsession *DBSession) error {
		_, err := dbsession.Table("configuration").
			Delete(query)
		if err != nil {
			return err
		}
		return nil
	})
}

func (ss *SQLStore) insertConfiguration(sess *DBSession, query *models.SetCustomConfiguration) error {
	_, err := sess.Table("configuration").
		Insert(query.Data)
	if err != nil {
		return err
	}
	return nil
}

func (ss *SQLStore) updateConfiguration(sess *DBSession, query *models.SetCustomConfiguration) error {
	_, err := sess.Table("configuration").
		Where("configuration.org_id = ?", query.OrgId).
		Nullable("doc_link", "support_link", "community_link", "video_link").
		Update(query.Data)
	if err != nil {
		return err
	}
	return nil
}

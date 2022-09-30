package sqlstore

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	alertRuleTarget = "alert_rule"
	dashboardTarget = "dashboard"
	filesTarget     = "file"
)

type targetCount struct {
	Count int64
}

func (ss *SQLStore) GetOrgQuotaByTarget(ctx context.Context, query *models.GetOrgQuotaByTargetQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		quota := models.Quota{
			Target: query.Target,
			OrgId:  query.OrgId,
		}
		has, err := sess.Get(&quota)
		if err != nil {
			return err
		} else if !has {
			quota.Limit = query.Default
		}

		var used int64
		if query.Target != alertRuleTarget || query.UnifiedAlertingEnabled {
			// get quota used.
			rawSQL := fmt.Sprintf("SELECT COUNT(*) AS count FROM %s WHERE org_id=?",
				dialect.Quote(query.Target))

			if query.Target == dashboardTarget {
				rawSQL += fmt.Sprintf(" AND is_folder=%s", dialect.BooleanStr(false))
			}

			resp := make([]*targetCount, 0)
			if err := sess.SQL(rawSQL, query.OrgId).Find(&resp); err != nil {
				return err
			}
			used = resp[0].Count
		}

		query.Result = &models.OrgQuotaDTO{
			Target: query.Target,
			Limit:  quota.Limit,
			OrgId:  query.OrgId,
			Used:   used,
		}

		return nil
	})
}

func (ss *SQLStore) GetOrgQuotas(ctx context.Context, query *models.GetOrgQuotasQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		quotas := make([]*models.Quota, 0)
		if err := sess.Table("quota").Where("org_id=? AND user_id=0", query.OrgId).Find(&quotas); err != nil {
			return err
		}

		defaultQuotas := setting.Quota.Org.ToMap()

		seenTargets := make(map[string]bool)
		for _, q := range quotas {
			seenTargets[q.Target] = true
		}

		for t, v := range defaultQuotas {
			if _, ok := seenTargets[t]; !ok {
				quotas = append(quotas, &models.Quota{
					OrgId:  query.OrgId,
					Target: t,
					Limit:  v,
				})
			}
		}

		result := make([]*models.OrgQuotaDTO, len(quotas))
		for i, q := range quotas {
			var used int64
			if q.Target != alertRuleTarget || query.UnifiedAlertingEnabled {
				// get quota used.
				rawSQL := fmt.Sprintf("SELECT COUNT(*) as count from %s where org_id=?", dialect.Quote(q.Target))
				resp := make([]*targetCount, 0)
				if err := sess.SQL(rawSQL, q.OrgId).Find(&resp); err != nil {
					return err
				}
				used = resp[0].Count
			}
			result[i] = &models.OrgQuotaDTO{
				Target: q.Target,
				Limit:  q.Limit,
				OrgId:  q.OrgId,
				Used:   used,
			}
		}
		query.Result = result
		return nil
	})
}

func (ss *SQLStore) UpdateOrgQuota(ctx context.Context, cmd *models.UpdateOrgQuotaCmd) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		// Check if quota is already defined in the DB
		quota := models.Quota{
			Target: cmd.Target,
			OrgId:  cmd.OrgId,
		}
		has, err := sess.Get(&quota)
		if err != nil {
			return err
		}
		quota.Updated = time.Now()
		quota.Limit = cmd.Limit
		if !has {
			quota.Created = time.Now()
			// No quota in the DB for this target, so create a new one.
			if _, err := sess.Insert(&quota); err != nil {
				return err
			}
		} else {
			// update existing quota entry in the DB.
			_, err := sess.ID(quota.Id).Update(&quota)
			if err != nil {
				return err
			}
		}

		return nil
	})
}

func (ss *SQLStore) GetUserQuotaByTarget(ctx context.Context, query *models.GetUserQuotaByTargetQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		quota := models.Quota{
			Target: query.Target,
			UserId: query.UserId,
		}
		has, err := sess.Get(&quota)
		if err != nil {
			return err
		} else if !has {
			quota.Limit = query.Default
		}

		var used int64
		if query.Target != alertRuleTarget || query.UnifiedAlertingEnabled {
			// get quota used.
			rawSQL := fmt.Sprintf("SELECT COUNT(*) as count from %s where user_id=?", dialect.Quote(query.Target))
			resp := make([]*targetCount, 0)
			if err := sess.SQL(rawSQL, query.UserId).Find(&resp); err != nil {
				return err
			}
			used = resp[0].Count
		}

		query.Result = &models.UserQuotaDTO{
			Target: query.Target,
			Limit:  quota.Limit,
			UserId: query.UserId,
			Used:   used,
		}

		return nil
	})
}

func (ss *SQLStore) GetUserQuotas(ctx context.Context, query *models.GetUserQuotasQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		quotas := make([]*models.Quota, 0)
		if err := sess.Table("quota").Where("user_id=? AND org_id=0", query.UserId).Find(&quotas); err != nil {
			return err
		}

		defaultQuotas := setting.Quota.User.ToMap()

		seenTargets := make(map[string]bool)
		for _, q := range quotas {
			seenTargets[q.Target] = true
		}

		for t, v := range defaultQuotas {
			if _, ok := seenTargets[t]; !ok {
				quotas = append(quotas, &models.Quota{
					UserId: query.UserId,
					Target: t,
					Limit:  v,
				})
			}
		}

		result := make([]*models.UserQuotaDTO, len(quotas))
		for i, q := range quotas {
			var used int64
			if q.Target != alertRuleTarget || query.UnifiedAlertingEnabled {
				// get quota used.
				rawSQL := fmt.Sprintf("SELECT COUNT(*) as count from %s where user_id=?", dialect.Quote(q.Target))
				resp := make([]*targetCount, 0)
				if err := sess.SQL(rawSQL, q.UserId).Find(&resp); err != nil {
					return err
				}
				used = resp[0].Count
			}
			result[i] = &models.UserQuotaDTO{
				Target: q.Target,
				Limit:  q.Limit,
				UserId: q.UserId,
				Used:   used,
			}
		}
		query.Result = result
		return nil
	})
}

func (ss *SQLStore) UpdateUserQuota(ctx context.Context, cmd *models.UpdateUserQuotaCmd) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		// Check if quota is already defined in the DB
		quota := models.Quota{
			Target: cmd.Target,
			UserId: cmd.UserId,
		}
		has, err := sess.Get(&quota)
		if err != nil {
			return err
		}
		quota.Updated = time.Now()
		quota.Limit = cmd.Limit
		if !has {
			quota.Created = time.Now()
			// No quota in the DB for this target, so create a new one.
			if _, err := sess.Insert(&quota); err != nil {
				return err
			}
		} else {
			// update existing quota entry in the DB.
			_, err := sess.ID(quota.Id).Update(&quota)
			if err != nil {
				return err
			}
		}

		return nil
	})
}

func (ss *SQLStore) GetGlobalQuotaByTarget(ctx context.Context, query *models.GetGlobalQuotaByTargetQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		var used int64

		if query.Target == filesTarget {
			// get quota used.
			rawSQL := fmt.Sprintf("SELECT COUNT(*) AS count FROM %s",
				dialect.Quote("file"))

			notFolderCondition := fmt.Sprintf(" WHERE path NOT LIKE '%s'", "%/")
			resp := make([]*targetCount, 0)
			if err := sess.SQL(rawSQL + notFolderCondition).Find(&resp); err != nil {
				return err
			}
			used = resp[0].Count
		} else if query.Target != alertRuleTarget || query.UnifiedAlertingEnabled {
			// get quota used.
			rawSQL := fmt.Sprintf("SELECT COUNT(*) AS count FROM %s",
				dialect.Quote(query.Target))

			if query.Target == dashboardTarget {
				rawSQL += fmt.Sprintf(" WHERE is_folder=%s", dialect.BooleanStr(false))
			}

			resp := make([]*targetCount, 0)
			if err := sess.SQL(rawSQL).Find(&resp); err != nil {
				return err
			}
			used = resp[0].Count
		}

		query.Result = &models.GlobalQuotaDTO{
			Target: query.Target,
			Limit:  query.Default,
			Used:   used,
		}

		return nil
	})
}

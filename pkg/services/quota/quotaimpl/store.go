package quotaimpl

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type store interface {
	Get(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error)
	Update(ctx context.Context, cmd *quota.UpdateQuotaCmd) error
	DeleteByUser(context.Context, int64) error
}

type sqlStore struct {
	db db.DB
}

func (ss *sqlStore) DeleteByUser(ctx context.Context, userID int64) error {
	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var rawSQL = "DELETE FROM quota WHERE user_id = ?"
		_, err := sess.Exec(rawSQL, userID)
		return err
	})
}

func (ss *sqlStore) Get(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	limits := quota.Map{}
	if scopeParams.OrgID != 0 {
		orgLimits, err := ss.getOrgScopeQuota(ctx, scopeParams.OrgID)
		if err != nil {
			return nil, err
		}
		limits.Merge(orgLimits)
	}

	if scopeParams.UserID != 0 {
		userLimits, err := ss.getUserScopeQuota(ctx, scopeParams.UserID)
		if err != nil {
			return nil, err
		}
		limits.Merge(userLimits)
	}

	return &limits, nil
}

func (ss *sqlStore) Update(ctx context.Context, cmd *quota.UpdateQuotaCmd) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// Check if quota is already defined in the DB
		quota := quota.Quota{
			Target: cmd.Target,
			UserId: cmd.UserId,
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

func (ss *sqlStore) getUserScopeQuota(ctx context.Context, userID int64) (*quota.Map, error) {
	r := quota.Map{}
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		quotas := make([]*quota.Quota, 0)
		if err := sess.Table("quota").Where("user_id=? AND org_id=0", userID).Find(&quotas); err != nil {
			return err
		}

		for _, q := range quotas {
			srv := quota.TargetSrv(q.Target)
			if q.Target == org.OrgUserQuotaTarget {
				srv = quota.TargetSrv(org.QuotaTargetSrv)
			}
			tag, err := quota.NewTag(srv, quota.Target(q.Target), quota.UserScope)
			if err != nil {
				return err
			}
			r.Set(tag, q.Limit)
		}
		return nil
	})
	return &r, err
}

func (ss *sqlStore) getOrgScopeQuota(ctx context.Context, OrgID int64) (*quota.Map, error) {
	r := quota.Map{}
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		quotas := make([]*quota.Quota, 0)
		if err := sess.Table("quota").Where("user_id=0 AND org_id=?", OrgID).Find(&quotas); err != nil {
			return err
		}

		for _, q := range quotas {
			srv := quota.TargetSrv(q.Target)
			if q.Target == org.OrgUserQuotaTarget {
				srv = quota.TargetSrv(org.QuotaTargetSrv)
			}
			tag, err := quota.NewTag(srv, quota.Target(q.Target), quota.OrgScope)
			if err != nil {
				return err
			}
			r.Set(tag, q.Limit)
		}
		return nil
	})
	return &r, err
}

package quotaimpl

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type store interface {
	Get(ctx quota.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error)
	Update(ctx quota.Context, cmd *quota.UpdateQuotaCmd) error
	DeleteByUser(quota.Context, int64) error
}

type sqlStore struct {
	sql    legacysql.LegacyDatabaseProvider
	logger log.Logger
}

type deleteByUserQuery struct {
	sqltemplate.SQLTemplate
	QuotaTable string
	UserID     int64
}

func (q deleteByUserQuery) Validate() error { return nil }

func (ss *sqlStore) DeleteByUser(ctx quota.Context, userID int64) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	query := deleteByUserQuery{
		SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
		QuotaTable:  dbHelper.Table("quota"),
		UserID:      userID,
	}
	querySQL, err := sqltemplate.Execute(deleteByUserTemplate, query)
	if err != nil {
		return err
	}

	return dbHelper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec(append([]any{querySQL}, query.GetArgs()...)...)
		return err
	})
}

func (ss *sqlStore) Get(ctx quota.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	limits := quota.Map{}
	if scopeParams == nil {
		return &limits, nil
	}
	if scopeParams.OrgID == 0 && scopeParams.UserID == 0 {
		return &limits, nil
	}

	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	if scopeParams.OrgID != 0 {
		orgLimits, err := ss.getOrgScopeQuota(ctx, dbHelper, scopeParams.OrgID)
		if err != nil {
			return nil, err
		}
		limits.Merge(orgLimits)
	}

	if scopeParams.UserID != 0 {
		userLimits, err := ss.getUserScopeQuota(ctx, dbHelper, scopeParams.UserID)
		if err != nil {
			return nil, err
		}
		limits.Merge(userLimits)
	}

	return &limits, nil
}

type findQuotaQuery struct {
	sqltemplate.SQLTemplate
	QuotaTable string
	Target     string
	UserID     int64
	OrgID      int64
}

func (q findQuotaQuery) Validate() error { return nil }

type insertQuotaQuery struct {
	sqltemplate.SQLTemplate
	QuotaTable string
	Target     string
	UserID     int64
	OrgID      int64
	Limit      int64
	Created    legacysql.DBTime
	Updated    legacysql.DBTime
}

func (q insertQuotaQuery) Validate() error { return nil }

type updateQuotaQuery struct {
	sqltemplate.SQLTemplate
	QuotaTable string
	QuotaID    int64
	Limit      int64
	Updated    legacysql.DBTime
}

func (q updateQuotaQuery) Validate() error { return nil }

func (ss *sqlStore) Update(ctx quota.Context, cmd *quota.UpdateQuotaCmd) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// Check if quota is already defined in the DB
		findQuery := findQuotaQuery{
			SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
			QuotaTable:  dbHelper.Table("quota"),
			Target:      cmd.Target,
			UserID:      cmd.UserID,
			OrgID:       cmd.OrgID,
		}
		findSQL, err := sqltemplate.Execute(findQuotaTemplate, findQuery)
		if err != nil {
			return err
		}

		var quotaID int64
		has, err := sess.SQL(findSQL, findQuery.GetArgs()...).Get(&quotaID)
		if err != nil {
			return err
		}

		updated := legacysql.NewDBTime(time.Now())
		limit := cmd.Limit
		if !has {
			created := legacysql.NewDBTime(time.Now())
			// No quota in the DB for this target, so create a new one.
			insertQuery := insertQuotaQuery{
				SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
				QuotaTable:  dbHelper.Table("quota"),
				Target:      cmd.Target,
				UserID:      cmd.UserID,
				OrgID:       cmd.OrgID,
				Limit:       limit,
				Created:     created,
				Updated:     updated,
			}
			insertSQL, err := sqltemplate.Execute(insertQuotaTemplate, insertQuery)
			if err != nil {
				return err
			}
			_, err = sess.Exec(append([]any{insertSQL}, insertQuery.GetArgs()...)...)
			return err
		} else {
			// update existing quota entry in the DB.
			updateQuery := updateQuotaQuery{
				SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
				QuotaTable:  dbHelper.Table("quota"),
				QuotaID:     quotaID,
				Limit:       limit,
				Updated:     updated,
			}
			updateSQL, err := sqltemplate.Execute(updateQuotaTemplate, updateQuery)
			if err != nil {
				return err
			}
			_, err = sess.Exec(append([]any{updateSQL}, updateQuery.GetArgs()...)...)
			return err
		}
	})
}

type userScopeQuotaQuery struct {
	sqltemplate.SQLTemplate
	QuotaTable string
	UserID     int64
	OrgID      int64
}

func (q userScopeQuotaQuery) Validate() error { return nil }

func (ss *sqlStore) getUserScopeQuota(ctx quota.Context, dbHelper *legacysql.LegacyDatabaseHelper, userID int64) (*quota.Map, error) {
	r := quota.Map{}
	query := userScopeQuotaQuery{
		SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
		QuotaTable:  dbHelper.Table("quota"),
		UserID:      userID,
		OrgID:       0,
	}
	querySQL, err := sqltemplate.Execute(userScopeQuotaTemplate, query)
	if err != nil {
		return nil, err
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		quotas := make([]*quota.Quota, 0)
		if err := sess.SQL(querySQL, query.GetArgs()...).Find(&quotas); err != nil {
			return err
		}

		for _, q := range quotas {
			srv, ok := ctx.TargetToSrv.Get(quota.Target(q.Target))
			if !ok {
				ss.logger.Info("failed to get service for target", "target", q.Target)
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

type orgScopeQuotaQuery struct {
	sqltemplate.SQLTemplate
	QuotaTable string
	UserID     int64
	OrgID      int64
}

func (q orgScopeQuotaQuery) Validate() error { return nil }

func (ss *sqlStore) getOrgScopeQuota(ctx quota.Context, dbHelper *legacysql.LegacyDatabaseHelper, orgID int64) (*quota.Map, error) {
	r := quota.Map{}
	query := orgScopeQuotaQuery{
		SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
		QuotaTable:  dbHelper.Table("quota"),
		UserID:      0,
		OrgID:       orgID,
	}
	querySQL, err := sqltemplate.Execute(orgScopeQuotaTemplate, query)
	if err != nil {
		return nil, err
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		quotas := make([]*quota.Quota, 0)
		if err := sess.SQL(querySQL, query.GetArgs()...).Find(&quotas); err != nil {
			return err
		}

		for _, q := range quotas {
			srv, ok := ctx.TargetToSrv.Get(quota.Target(q.Target))
			if !ok {
				ss.logger.Info("failed to get service for target", "target", q.Target)
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

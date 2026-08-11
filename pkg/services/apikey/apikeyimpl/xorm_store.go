package apikeyimpl

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

type sqlStore struct {
	sql legacysql.LegacyDatabaseProvider
}

// quoteTable resolves a table name and quotes it for use in raw SQL.
func quoteTable(dbHelper *legacysql.LegacyDatabaseHelper, name string) string {
	return dbHelper.DB.Quote(dbHelper.Table(name))
}

// timeNow makes it possible to test usage of time
var timeNow = time.Now

func (ss *sqlStore) GetAllAPIKeys(ctx context.Context, orgID int64) ([]*apikey.APIKey, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	result := make([]*apikey.APIKey, 0)
	err = dbHelper.DB.WithDbSession(ctx, func(dbSession *db.Session) error {
		sess := dbSession.Table(dbHelper.Table("api_key")).
			Where("service_account_id IS NULL").Asc("name")
		if orgID != -1 {
			sess = sess.Where("org_id=?", orgID)
		}
		return sess.Find(&result)
	})
	return result, err
}

func (ss *sqlStore) AddAPIKey(ctx context.Context, cmd *apikey.AddCommand) (res *apikey.APIKey, err error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		key := apikey.APIKey{OrgID: cmd.OrgID, Name: cmd.Name}
		exists, _ := sess.Table(dbHelper.Table("api_key")).Get(&key)
		if exists {
			return apikey.ErrDuplicate
		}

		updated := timeNow()
		var expires *int64 = nil
		if cmd.SecondsToLive > 0 {
			v := updated.Add(time.Second * time.Duration(cmd.SecondsToLive)).Unix()
			expires = &v
		} else if cmd.SecondsToLive < 0 {
			return apikey.ErrInvalidExpiration
		}

		isRevoked := false
		t := apikey.APIKey{
			OrgID:            cmd.OrgID,
			Name:             cmd.Name,
			Role:             cmd.Role,
			Key:              cmd.Key,
			Created:          updated,
			Updated:          updated,
			Expires:          expires,
			ServiceAccountId: cmd.ServiceAccountID,
			IsRevoked:        &isRevoked,
		}

		if _, err := sess.Table(dbHelper.Table("api_key")).Insert(&t); err != nil {
			return fmt.Errorf("%s: %w", "failed to insert token", err)
		}
		res = &t
		return nil
	})
	return res, err
}

func (ss *sqlStore) GetApiKeyByName(ctx context.Context, query *apikey.GetByNameQuery) (res *apikey.APIKey, err error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		var key apikey.APIKey
		has, err := sess.Table(dbHelper.Table("api_key")).
			Where("org_id=? AND name=?", query.OrgID, query.KeyName).Get(&key)

		if err != nil {
			return err
		} else if !has {
			return apikey.ErrInvalid
		}

		res = &key
		return nil
	})
	return res, err
}

func (ss *sqlStore) GetAPIKeyByHash(ctx context.Context, hash string) (*apikey.APIKey, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	var key apikey.APIKey
	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.Table(dbHelper.Table("api_key")).
			Where(fmt.Sprintf("%s = ?", dbHelper.DB.GetDialect().Quote("key")), hash).Get(&key)
		if err != nil {
			return err
		} else if !has {
			return apikey.ErrInvalid
		}
		return nil
	})
	return &key, err
}

func (ss *sqlStore) UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	now := timeNow()
	return dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		if _, err := sess.Table(dbHelper.Table("api_key")).ID(tokenID).Cols("last_used_at").Update(&apikey.APIKey{LastUsedAt: &now}); err != nil {
			return err
		}

		return nil
	})
}

func (ss *sqlStore) Count(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	u := &quota.Map{}
	type result struct {
		Count int64
	}

	r := result{}
	if err := dbHelper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rawSQL := "SELECT COUNT(*) AS count FROM " + quoteTable(dbHelper, "api_key")
		if _, err := sess.SQL(rawSQL).Get(&r); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return u, err
	} else {
		tag, err := quota.NewTag(apikey.QuotaTargetSrv, apikey.QuotaTarget, quota.GlobalScope)
		if err != nil {
			return nil, err
		}
		u.Set(tag, r.Count)
	}

	if scopeParams != nil && scopeParams.OrgID != 0 {
		if err := dbHelper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			rawSQL := "SELECT COUNT(*) AS count FROM " + quoteTable(dbHelper, "api_key") + " WHERE org_id = ?"
			if _, err := sess.SQL(rawSQL, scopeParams.OrgID).Get(&r); err != nil {
				return err
			}
			return nil
		}); err != nil {
			return u, err
		} else {
			tag, err := quota.NewTag(apikey.QuotaTargetSrv, apikey.QuotaTarget, quota.OrgScope)
			if err != nil {
				return nil, err
			}
			u.Set(tag, r.Count)
		}
	}

	return u, nil
}

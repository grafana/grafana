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
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type sqlStore struct {
	sql legacysql.LegacyDatabaseProvider
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

type countAPIKeysQuery struct {
	sqltemplate.SQLTemplate
	APIKeyTable string
	OrgID       int64
}

func (q countAPIKeysQuery) Validate() error { return nil }

func countAPIKeys(dbHelper *legacysql.LegacyDatabaseHelper, sess *sqlstore.DBSession, scope quota.Scope, orgID int64, u *quota.Map) error {
	query := countAPIKeysQuery{
		SQLTemplate: sqltemplate.New(dbHelper.DialectForDriver()),
		APIKeyTable: dbHelper.Table("api_key"),
		OrgID:       orgID,
	}
	rawSQL, err := sqltemplate.Execute(countAPIKeysTemplate, query)
	if err != nil {
		return err
	}

	r := struct{ Count int64 }{}
	if _, err := sess.SQL(rawSQL, query.GetArgs()...).Get(&r); err != nil {
		return err
	}

	tag, err := quota.NewTag(apikey.QuotaTargetSrv, apikey.QuotaTarget, scope)
	if err != nil {
		return err
	}
	u.Set(tag, r.Count)
	return nil
}

func (ss *sqlStore) Count(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	u := &quota.Map{}
	err = dbHelper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if err := countAPIKeys(dbHelper, sess, quota.GlobalScope, 0, u); err != nil {
			return err
		}
		if scopeParams != nil && scopeParams.OrgID != 0 {
			return countAPIKeys(dbHelper, sess, quota.OrgScope, scopeParams.OrgID, u)
		}
		return nil
	})
	return u, err
}

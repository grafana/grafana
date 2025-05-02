package apikeyimpl

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type sqlStore struct {
	db db.DB
}

// timeNow makes it possible to test usage of time
var timeNow = time.Now

func (ss *sqlStore) GetAPIKeys(ctx context.Context, query *apikey.GetApiKeysQuery) (res []*apikey.APIKey, err error) {
	err = ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		var sess *xorm.Session

		if query.IncludeExpired {
			sess = dbSession.Limit(100, 0).
				Where("org_id=?", query.OrgID).
				Asc("name")
		} else {
			sess = dbSession.Limit(100, 0).
				Where("org_id=? and ( expires IS NULL or expires >= ?)", query.OrgID, timeNow().Unix()).
				Asc("name")
		}

		sess = sess.Where("service_account_id IS NULL")

		filter, err := accesscontrol.Filter(query.User, "id", "apikeys:id:", accesscontrol.ActionAPIKeyRead)
		if err != nil {
			return err
		}
		sess.And(filter.Where, filter.Args...)

		res = make([]*apikey.APIKey, 0)
		return sess.Find(&res)
	})
	return res, err
}

func (ss *sqlStore) GetAllAPIKeys(ctx context.Context, orgID int64) ([]*apikey.APIKey, error) {
	result := make([]*apikey.APIKey, 0)
	err := ss.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		sess := dbSession.Where("service_account_id IS NULL").Asc("name")
		if orgID != -1 {
			sess = sess.Where("org_id=?", orgID)
		}
		return sess.Find(&result)
	})
	return result, err
}

func (ss *sqlStore) CountAPIKeys(ctx context.Context, orgID int64) (int64, error) {
	type result struct {
		Count int64
	}

	r := result{}
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rawSQL := "SELECT COUNT(*) AS count FROM api_key WHERE org_id = ? and service_account_id IS NULL"
		if _, err := sess.SQL(rawSQL, orgID).Get(&r); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return r.Count, err
}

func (ss *sqlStore) DeleteApiKey(ctx context.Context, cmd *apikey.DeleteCommand) error {
	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		rawSQL := "DELETE FROM api_key WHERE id=? and org_id=? and service_account_id IS NULL"
		result, err := sess.Exec(rawSQL, cmd.ID, cmd.OrgID)
		if err != nil {
			return err
		}
		n, err := result.RowsAffected()
		if err != nil {
			return err
		} else if n == 0 {
			return apikey.ErrNotFound
		}
		return nil
	})
}

func (ss *sqlStore) AddAPIKey(ctx context.Context, cmd *apikey.AddCommand) (res *apikey.APIKey, err error) {
	err = ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		key := apikey.APIKey{OrgID: cmd.OrgID, Name: cmd.Name}
		exists, _ := sess.Get(&key)
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

		if _, err := sess.Insert(&t); err != nil {
			return fmt.Errorf("%s: %w", "failed to insert token", err)
		}
		res = &t
		return nil
	})
	return res, err
}

func (ss *sqlStore) GetApiKeyById(ctx context.Context, query *apikey.GetByIDQuery) (res *apikey.APIKey, err error) {
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var key apikey.APIKey
		has, err := sess.ID(query.ApiKeyID).Get(&key)

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

func (ss *sqlStore) GetApiKeyByName(ctx context.Context, query *apikey.GetByNameQuery) (res *apikey.APIKey, err error) {
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var key apikey.APIKey
		has, err := sess.Where("org_id=? AND name=?", query.OrgID, query.KeyName).Get(&key)

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
	var key apikey.APIKey
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		has, err := sess.Table("api_key").Where(fmt.Sprintf("%s = ?", ss.db.GetDialect().Quote("key")), hash).Get(&key)
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
	now := timeNow()
	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		if _, err := sess.Table("api_key").ID(tokenID).Cols("last_used_at").Update(&apikey.APIKey{LastUsedAt: &now}); err != nil {
			return err
		}

		return nil
	})
}

func (ss *sqlStore) Count(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	u := &quota.Map{}
	type result struct {
		Count int64
	}

	r := result{}
	if err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rawSQL := "SELECT COUNT(*) AS count FROM api_key"
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
		if err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			rawSQL := "SELECT COUNT(*) AS count FROM api_key WHERE org_id = ?"
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

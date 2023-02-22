package apikeyimpl

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/setting"
)

type sqlxStore struct {
	sess *session.SessionDB
	cfg  *setting.Cfg
}

func (ss *sqlxStore) GetAPIKeys(ctx context.Context, query *apikey.GetApiKeysQuery) error {
	var where []string
	var args []interface{}

	if query.IncludeExpired {
		where = append(where, "org_id=?")
		args = append(args, query.OrgID)
	} else {
		where = append(where, "org_id=? and ( expires IS NULL or expires >= ?)")
		args = append(args, query.OrgID, timeNow().Unix())
	}

	where = append(where, "service_account_id IS NULL")

	if !accesscontrol.IsDisabled(ss.cfg) {
		filter, err := accesscontrol.Filter(query.User, "id", "apikeys:id:", accesscontrol.ActionAPIKeyRead)
		if err != nil {
			return err
		}
		where = append(where, filter.Where)
		args = append(args, filter.Args...)
	}

	ws := fmt.Sprint(strings.Join(where[:], " AND "))
	qr := fmt.Sprintf(`SELECT * FROM api_key WHERE %s ORDER BY name ASC LIMIT 100`, ws)
	query.Result = make([]*apikey.APIKey, 0)
	err := ss.sess.Select(ctx, &query.Result, qr, args...)
	return err
}

func (ss *sqlxStore) GetAllAPIKeys(ctx context.Context, orgID int64) ([]*apikey.APIKey, error) {
	result := make([]*apikey.APIKey, 0)
	var err error
	if orgID != -1 {
		err = ss.sess.Select(
			ctx, &result, "SELECT * FROM api_key WHERE service_account_id IS NULL AND org_id = ? ORDER BY name ASC", orgID)
	} else {
		err = ss.sess.Select(
			ctx, &result, "SELECT * FROM api_key WHERE service_account_id IS NULL ORDER BY name ASC")
	}
	return result, err
}

func (ss *sqlxStore) CountAPIKeys(ctx context.Context, orgID int64) (int64, error) {
	type result struct {
		Count int64
	}
	r := result{}
	err := ss.sess.Get(ctx, &r, `SELECT COUNT(*) AS count FROM api_key WHERE service_account_id IS NULL and org_id = ?`, orgID)
	if err != nil {
		return 0, err
	}
	return r.Count, err
}

func (ss *sqlxStore) DeleteApiKey(ctx context.Context, cmd *apikey.DeleteCommand) error {
	res, err := ss.sess.Exec(ctx, "DELETE FROM api_key WHERE id=? and org_id=? and service_account_id IS NULL", cmd.ID, cmd.OrgID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err == nil && n == 0 {
		return apikey.ErrNotFound
	}
	return err
}

func (ss *sqlxStore) AddAPIKey(ctx context.Context, cmd *apikey.AddCommand) error {
	updated := timeNow()
	var expires *int64 = nil
	if cmd.SecondsToLive > 0 {
		v := updated.Add(time.Second * time.Duration(cmd.SecondsToLive)).Unix()
		expires = &v
	} else if cmd.SecondsToLive < 0 {
		return apikey.ErrInvalidExpiration
	}

	err := ss.GetApiKeyByName(ctx, &apikey.GetByNameQuery{OrgID: cmd.OrgID, KeyName: cmd.Name})
	// If key with the same orgId and name already exist return err
	if !errors.Is(err, apikey.ErrInvalid) {
		return apikey.ErrDuplicate
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
		ServiceAccountId: nil,
		IsRevoked:        &isRevoked,
	}

	t.ID, err = ss.sess.ExecWithReturningId(ctx,
		`INSERT INTO api_key (org_id, name, role, "key", created, updated, expires, service_account_id, is_revoked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, t.OrgID, t.Name, t.Role, t.Key, t.Created, t.Updated, t.Expires, t.ServiceAccountId, t.IsRevoked)
	cmd.Result = &t
	return err
}

func (ss *sqlxStore) GetApiKeyById(ctx context.Context, query *apikey.GetByIDQuery) error {
	var key apikey.APIKey
	err := ss.sess.Get(ctx, &key, "SELECT * FROM api_key WHERE id=?", query.ApiKeyID)
	if err != nil && errors.Is(err, sql.ErrNoRows) {
		return apikey.ErrInvalid
	}
	query.Result = &key
	return err
}

func (ss *sqlxStore) GetApiKeyByName(ctx context.Context, query *apikey.GetByNameQuery) error {
	var key apikey.APIKey
	err := ss.sess.Get(ctx, &key, "SELECT * FROM api_key WHERE org_id=? AND name=?", query.OrgID, query.KeyName)
	if err != nil && errors.Is(err, sql.ErrNoRows) {
		return apikey.ErrInvalid
	}
	query.Result = &key
	return err
}

func (ss *sqlxStore) GetAPIKeyByHash(ctx context.Context, hash string) (*apikey.APIKey, error) {
	var key apikey.APIKey
	err := ss.sess.Get(ctx, &key, `SELECT * FROM api_key WHERE "key"=?`, hash)
	if err != nil && errors.Is(err, sql.ErrNoRows) {
		return nil, apikey.ErrInvalid
	}
	return &key, err
}

func (ss *sqlxStore) UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error {
	now := timeNow()
	_, err := ss.sess.Exec(ctx, `UPDATE api_key SET last_used_at=? WHERE id=?`, &now, tokenID)
	return err
}

func (ss *sqlxStore) Count(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	u := &quota.Map{}
	type result struct {
		Count int64
	}

	r := result{}
	if err := ss.sess.Get(ctx, &r, `SELECT COUNT(*) AS count FROM api_key`); err != nil {
		return u, err
	} else {
		tag, err := quota.NewTag(apikey.QuotaTargetSrv, apikey.QuotaTarget, quota.GlobalScope)
		if err != nil {
			return nil, err
		}
		u.Set(tag, r.Count)
	}

	if scopeParams != nil && scopeParams.OrgID != 0 {
		if err := ss.sess.Get(ctx, &r, `SELECT COUNT(*) AS count FROM api_key WHERE org_id = ?`, scopeParams.OrgID); err != nil {
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

package apikeyimpl

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/setting"
	"xorm.io/xorm"
)

type store interface {
	GetAPIKeys(ctx context.Context, query *models.GetApiKeysQuery) error
	GetAllAPIKeys(ctx context.Context, orgID int64) []*models.ApiKey
	DeleteApiKey(ctx context.Context, cmd *models.DeleteApiKeyCommand) error
	AddAPIKey(ctx context.Context, cmd *models.AddApiKeyCommand) error
	GetApiKeyById(ctx context.Context, query *models.GetApiKeyByIdQuery) error
	GetApiKeyByName(ctx context.Context, query *models.GetApiKeyByNameQuery) error
	GetAPIKeyByHash(ctx context.Context, hash string) (*models.ApiKey, error)
	UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error
}

type sqlStore struct {
	db  db.DB
	cfg *setting.Cfg
}

// timeNow makes it possible to test usage of time
var timeNow = time.Now

func (ss *sqlStore) GetAPIKeys(ctx context.Context, query *models.GetApiKeysQuery) error {
	return ss.db.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		var sess *xorm.Session

		if query.IncludeExpired {
			sess = dbSession.Limit(100, 0).
				Where("org_id=?", query.OrgId).
				Asc("name")
		} else {
			sess = dbSession.Limit(100, 0).
				Where("org_id=? and ( expires IS NULL or expires >= ?)", query.OrgId, timeNow().Unix()).
				Asc("name")
		}

		sess = sess.Where("service_account_id IS NULL")

		if !accesscontrol.IsDisabled(ss.cfg) {
			filter, err := accesscontrol.Filter(query.User, "id", "apikeys:id:", accesscontrol.ActionAPIKeyRead)
			if err != nil {
				return err
			}
			sess.And(filter.Where, filter.Args...)
		}

		query.Result = make([]*models.ApiKey, 0)
		return sess.Find(&query.Result)
	})
}

func (ss *sqlStore) GetAllAPIKeys(ctx context.Context, orgID int64) []*models.ApiKey {
	result := make([]*models.ApiKey, 0)
	err := ss.db.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		sess := dbSession.Where("service_account_id IS NULL").Asc("name")
		if orgID != -1 {
			sess = sess.Where("org_id=?", orgID)
		}
		return sess.Find(&result)
	})
	if err != nil {
		_ = err
		// TODO: return error
	}
	return result
}

func (ss *sqlStore) DeleteApiKey(ctx context.Context, cmd *models.DeleteApiKeyCommand) error {
	return ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rawSQL := "DELETE FROM api_key WHERE id=? and org_id=? and service_account_id IS NULL"
		result, err := sess.Exec(rawSQL, cmd.Id, cmd.OrgId)
		if err != nil {
			return err
		}
		n, err := result.RowsAffected()
		if err != nil {
			return err
		} else if n == 0 {
			return models.ErrApiKeyNotFound
		}
		return nil
	})
}

func (ss *sqlStore) AddAPIKey(ctx context.Context, cmd *models.AddApiKeyCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		key := models.ApiKey{OrgId: cmd.OrgId, Name: cmd.Name}
		exists, _ := sess.Get(&key)
		if exists {
			return models.ErrDuplicateApiKey
		}

		updated := timeNow()
		var expires *int64 = nil
		if cmd.SecondsToLive > 0 {
			v := updated.Add(time.Second * time.Duration(cmd.SecondsToLive)).Unix()
			expires = &v
		} else if cmd.SecondsToLive < 0 {
			return models.ErrInvalidApiKeyExpiration
		}

		t := models.ApiKey{
			OrgId:            cmd.OrgId,
			Name:             cmd.Name,
			Role:             cmd.Role,
			Key:              cmd.Key,
			Created:          updated,
			Updated:          updated,
			Expires:          expires,
			ServiceAccountId: nil,
		}

		if _, err := sess.Insert(&t); err != nil {
			return err
		}
		cmd.Result = &t
		return nil
	})
}

func (ss *sqlStore) GetApiKeyById(ctx context.Context, query *models.GetApiKeyByIdQuery) error {
	return ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var apikey models.ApiKey
		has, err := sess.ID(query.ApiKeyId).Get(&apikey)

		if err != nil {
			return err
		} else if !has {
			return models.ErrInvalidApiKey
		}

		query.Result = &apikey
		return nil
	})
}

func (ss *sqlStore) GetApiKeyByName(ctx context.Context, query *models.GetApiKeyByNameQuery) error {
	return ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var apikey models.ApiKey
		has, err := sess.Where("org_id=? AND name=?", query.OrgId, query.KeyName).Get(&apikey)

		if err != nil {
			return err
		} else if !has {
			return models.ErrInvalidApiKey
		}

		query.Result = &apikey
		return nil
	})
}

func (ss *sqlStore) GetAPIKeyByHash(ctx context.Context, hash string) (*models.ApiKey, error) {
	var apikey models.ApiKey
	err := ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		has, err := sess.Table("api_key").Where(fmt.Sprintf("%s = ?", ss.db.GetDialect().Quote("key")), hash).Get(&apikey)
		if err != nil {
			return err
		} else if !has {
			return models.ErrInvalidApiKey
		}
		return nil
	})
	return &apikey, err
}

func (ss *sqlStore) UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error {
	now := timeNow()
	return ss.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if _, err := sess.Table("api_key").ID(tokenID).Cols("last_used_at").Update(&models.ApiKey{LastUsedAt: &now}); err != nil {
			return err
		}

		return nil
	})
}

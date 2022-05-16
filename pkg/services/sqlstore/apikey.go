package sqlstore

import (
	"context"
	"fmt"
	"time"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// GetAPIKeys queries the database based
// on input on GetApiKeysQuery
func (ss *SQLStore) GetAPIKeys(ctx context.Context, query *models.GetApiKeysQuery) error {
	return ss.WithDbSession(ctx, func(dbSession *DBSession) error {
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

		if !accesscontrol.IsDisabled(ss.Cfg) {
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

// GetAllOrgsAPIKeys queries the database for valid non SA APIKeys across all orgs
func (ss *SQLStore) GetAllOrgsAPIKeys(ctx context.Context) []*models.ApiKey {
	result := make([]*models.ApiKey, 0)
	err := ss.WithDbSession(ctx, func(dbSession *DBSession) error {
		sess := dbSession. //CHECK how many API keys do our clients have?  Can we load them all?
					Where("(expires IS NULL OR expires >= ?) AND service_account_id IS NULL", timeNow().Unix()).Asc("name")
		return sess.Find(&result)
	})
	if err != nil {
		ss.log.Warn("API key not loaded", "err", err)
	}
	return result
}

func (ss *SQLStore) DeleteApiKey(ctx context.Context, cmd *models.DeleteApiKeyCommand) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		return deleteAPIKey(sess, cmd.Id, cmd.OrgId)
	})
}

func deleteAPIKey(sess *DBSession, id, orgID int64) error {
	rawSQL := "DELETE FROM api_key WHERE id=? and org_id=? and service_account_id IS NULL"
	result, err := sess.Exec(rawSQL, id, orgID)
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
}

// AddAPIKey adds the API key to the database.
func (ss *SQLStore) AddAPIKey(ctx context.Context, cmd *models.AddApiKeyCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
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

func (ss *SQLStore) GetApiKeyById(ctx context.Context, query *models.GetApiKeyByIdQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
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

func (ss *SQLStore) GetApiKeyByName(ctx context.Context, query *models.GetApiKeyByNameQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
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

func (ss *SQLStore) GetAPIKeyByHash(ctx context.Context, hash string) (*models.ApiKey, error) {
	var apikey models.ApiKey
	err := ss.WithDbSession(ctx, func(sess *DBSession) error {
		has, err := sess.Table("api_key").Where(fmt.Sprintf("%s = ?", dialect.Quote("key")), hash).Get(&apikey)
		if err != nil {
			return err
		} else if !has {
			return models.ErrInvalidApiKey
		}

		return nil
	})

	return &apikey, err
}

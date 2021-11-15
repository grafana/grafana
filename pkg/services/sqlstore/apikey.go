package sqlstore

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"xorm.io/xorm"
)

func (ss *SQLStore) addAPIKeysQueryAndCommandHandlers() {
	bus.AddHandlerCtx("sql", ss.GetAPIKeys)
	bus.AddHandlerCtx("sql", ss.GetApiKeyById)
	bus.AddHandlerCtx("sql", ss.GetApiKeyByName)
	bus.AddHandlerCtx("sql", ss.DeleteApiKeyCtx)
	bus.AddHandlerCtx("sql", ss.AddAPIKey)
}

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

		query.Result = make([]*models.ApiKey, 0)
		return sess.Find(&query.Result)
	})
}

func (ss *SQLStore) DeleteApiKeyCtx(ctx context.Context, cmd *models.DeleteApiKeyCommand) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		return deleteAPIKey(sess, cmd.Id, cmd.OrgId)
	})
}

func deleteAPIKey(sess *DBSession, id, orgID int64) error {
	rawSQL := "DELETE FROM api_key WHERE id=? and org_id=?"
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
			ServiceAccountId: cmd.ServiceAccountId,
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

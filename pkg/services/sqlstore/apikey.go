package sqlstore

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetApiKeys)
	bus.AddHandler("sql", GetApiKeyById)
	bus.AddHandler("sql", GetApiKeyByName)
	bus.AddHandlerCtx("sql", DeleteApiKeyCtx)
	bus.AddHandler("sql", AddApiKey)
}

func GetApiKeys(query *models.GetApiKeysQuery) error {
	sess := x.Limit(100, 0).Where("org_id=? and ( expires IS NULL or expires >= ?)",
		query.OrgId, timeNow().Unix()).Asc("name")
	if query.IncludeExpired {
		sess = x.Limit(100, 0).Where("org_id=?", query.OrgId).Asc("name")
	}

	query.Result = make([]*models.ApiKey, 0)
	return sess.Find(&query.Result)
}

func DeleteApiKeyCtx(ctx context.Context, cmd *models.DeleteApiKeyCommand) error {
	return withDbSession(ctx, func(sess *DBSession) error {
		var rawSQL = "DELETE FROM api_key WHERE id=? and org_id=?"
		_, err := sess.Exec(rawSQL, cmd.Id, cmd.OrgId)
		return err
	})
}

func AddApiKey(cmd *models.AddApiKeyCommand) error {
	newKeyInfo, err := apikeygen.New(cmd.OrgId, cmd.Name)
	if err != nil {
		return err
	}

	return inTransaction(func(sess *DBSession) error {
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
			OrgId:   cmd.OrgId,
			Name:    cmd.Name,
			Role:    cmd.Role,
			Key:     newKeyInfo.HashedKey,
			Created: updated,
			Updated: updated,
			Expires: expires,
		}

		if _, err := sess.Insert(&t); err != nil {
			return err
		}
		cmd.Result = &models.ApiKeyClientSecret{
			Id:   t.Id,
			Name: t.Name,
			Key:  newKeyInfo.ClientSecret,
		}
		return nil
	})
}

func GetApiKeyById(query *models.GetApiKeyByIdQuery) error {
	var apikey models.ApiKey
	has, err := x.Id(query.ApiKeyId).Get(&apikey)

	if err != nil {
		return err
	} else if !has {
		return models.ErrInvalidApiKey
	}

	query.Result = &apikey
	return nil
}

func GetApiKeyByName(query *models.GetApiKeyByNameQuery) error {
	var apikey models.ApiKey
	has, err := x.Where("org_id=? AND name=?", query.OrgId, query.KeyName).Get(&apikey)

	if err != nil {
		return err
	} else if !has {
		return models.ErrInvalidApiKey
	}

	query.Result = &apikey
	return nil
}

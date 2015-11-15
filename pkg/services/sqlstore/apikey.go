package sqlstore

import (
	"time"

	"github.com/go-xorm/xorm"
	"github.com/wangy1931/grafana/pkg/bus"
	m "github.com/wangy1931/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetApiKeys)
	bus.AddHandler("sql", GetApiKeyById)
	bus.AddHandler("sql", GetApiKeyByName)
	bus.AddHandler("sql", DeleteApiKey)
	bus.AddHandler("sql", AddApiKey)
}

func GetApiKeys(query *m.GetApiKeysQuery) error {
	sess := x.Limit(100, 0).Where("org_id=?", query.OrgId).Asc("name")

	query.Result = make([]*m.ApiKey, 0)
	return sess.Find(&query.Result)
}

func DeleteApiKey(cmd *m.DeleteApiKeyCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		var rawSql = "DELETE FROM api_key WHERE id=? and org_id=?"
		_, err := sess.Exec(rawSql, cmd.Id, cmd.OrgId)
		return err
	})
}

func AddApiKey(cmd *m.AddApiKeyCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		t := m.ApiKey{
			OrgId:   cmd.OrgId,
			Name:    cmd.Name,
			Role:    cmd.Role,
			Key:     cmd.Key,
			Created: time.Now(),
			Updated: time.Now(),
		}

		if _, err := sess.Insert(&t); err != nil {
			return err
		}
		cmd.Result = &t
		return nil
	})
}

func GetApiKeyById(query *m.GetApiKeyByIdQuery) error {
	var apikey m.ApiKey
	has, err := x.Id(query.ApiKeyId).Get(&apikey)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrInvalidApiKey
	}

	query.Result = &apikey
	return nil
}

func GetApiKeyByName(query *m.GetApiKeyByNameQuery) error {
	var apikey m.ApiKey
	has, err := x.Where("org_id=? AND name=?", query.OrgId, query.KeyName).Get(&apikey)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrInvalidApiKey
	}

	query.Result = &apikey
	return nil
}

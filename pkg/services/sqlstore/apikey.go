package sqlstore

import (
	"time"

	"github.com/go-xorm/xorm"
	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetApiKeys)
	bus.AddHandler("sql", GetApiKeyByKey)
	bus.AddHandler("sql", UpdateApiKey)
	bus.AddHandler("sql", DeleteApiKey)
	bus.AddHandler("sql", AddApiKey)
}

func GetApiKeys(query *m.GetApiKeysQuery) error {
	sess := x.Limit(100, 0).Where("account_id=?", query.AccountId).Asc("name")

	query.Result = make([]*m.ApiKey, 0)
	return sess.Find(&query.Result)
}

func DeleteApiKey(cmd *m.DeleteApiKeyCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		var rawSql = "DELETE FROM api_key WHERE id=? and account_id=?"
		_, err := sess.Exec(rawSql, cmd.Id, cmd.AccountId)
		return err
	})
}

func AddApiKey(cmd *m.AddApiKeyCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		t := m.ApiKey{
			AccountId: cmd.AccountId,
			Name:      cmd.Name,
			Role:      cmd.Role,
			Key:       cmd.Key,
			Created:   time.Now(),
			Updated:   time.Now(),
		}

		if _, err := sess.Insert(&t); err != nil {
			return err
		}
		cmd.Result = &t
		return nil
	})
}

func UpdateApiKey(cmd *m.UpdateApiKeyCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		t := m.ApiKey{
			Id:        cmd.Id,
			AccountId: cmd.AccountId,
			Name:      cmd.Name,
			Role:      cmd.Role,
			Updated:   time.Now(),
		}
		_, err := sess.Where("id=? and account_id=?", t.Id, t.AccountId).Update(&t)
		return err
	})
}

func GetApiKeyByKey(query *m.GetApiKeyByKeyQuery) error {
	var apikey m.ApiKey
	has, err := x.Where("key=?", query.Key).Get(&apikey)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrInvalidApiKey
	}

	query.Result = &apikey
	return nil
}

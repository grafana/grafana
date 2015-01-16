package sqlstore

import (
	"time"

	"github.com/go-xorm/xorm"
	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetTokens)
	bus.AddHandler("sql", GetTokenByToken)
	bus.AddHandler("sql", UpdateToken)
	bus.AddHandler("sql", DeleteToken)
	bus.AddHandler("sql", DeleteToken)
}

func GetTokens(query *m.GetTokensQuery) error {
	sess := x.Limit(100, 0).Where("account_id=?", query.AccountId).Asc("name")

	query.Result = make([]*m.Token, 0)
	return sess.Find(&query.Result)
}

func DeleteToken(cmd *m.DeleteTokenCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		var rawSql = "DELETE FROM token WHERE id=? and account_id=?"
		_, err := sess.Exec(rawSql, cmd.Id, cmd.AccountId)
		return err
	})
}

func AddToken(cmd *m.AddTokenCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		t := m.Token{
			AccountId: cmd.AccountId,
			Name:      cmd.Name,
			Role:      cmd.Role,
			Token:     cmd.Token,
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

func UpdateToken(cmd *m.UpdateTokenCommand) error {

	return inTransaction(func(sess *xorm.Session) error {
		t := m.Token{
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

func GetTokenByToken(query *m.GetTokenByTokenQuery) error {
	var token m.Token
	has, err := x.Where("token=?", query.Token).Get(&token)

	if err != nil {
		return err
	} else if has == false {
		return m.ErrInvalidToken
	}

	query.Result = &token
	return nil
}

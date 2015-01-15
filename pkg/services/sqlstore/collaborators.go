package sqlstore

import (
	"time"

	"github.com/go-xorm/xorm"

	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func init() {
	bus.AddHandler("sql", AddCollaborator)
	bus.AddHandler("sql", RemoveCollaborator)
	bus.AddHandler("sql", GetCollaborators)
}

func AddCollaborator(cmd *m.AddCollaboratorCommand) error {
	return inTransaction(func(sess *xorm.Session) error {

		entity := m.Collaborator{
			AccountId:      cmd.AccountId,
			CollaboratorId: cmd.CollaboratorId,
			Role:           cmd.Role,
			Created:        time.Now(),
			Updated:        time.Now(),
		}

		_, err := sess.Insert(&entity)
		return err
	})
}

func GetCollaborators(query *m.GetCollaboratorsQuery) error {
	query.Result = make([]*m.CollaboratorDTO, 0)
	sess := x.Table("collaborator")
	sess.Join("INNER", "account", "collaborator.collaborator_id=account.id")
	sess.Where("collaborator.account_id=?", query.AccountId)
	sess.Cols("collaborator.collaborator_id", "collaborator.role", "account.email", "account.login")

	err := sess.Find(&query.Result)
	return err
}

func RemoveCollaborator(cmd *m.RemoveCollaboratorCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		var rawSql = "DELETE FROM collaborator WHERE collaborator_id=? and account_id=?"
		_, err := sess.Exec(rawSql, cmd.CollaboratorId, cmd.AccountId)
		return err
	})
}

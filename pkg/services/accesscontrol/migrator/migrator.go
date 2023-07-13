package migrator

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
)

func MigrateScopeSplit(db db.DB, log log.Logger) error {
	// TODO: DROP INDEXES IF EXISTS
	/*
			var permissions []accesscontrol.Permission

			sess.SQL("SELECT * FROM permission WHERE scope IS NOT ''").Find(&permissions)

			for i, p := range permissions {
				kind, attribute, identifier := p.SplitScope()

				permissions[i].Kind = kind
				permissions[i].Attribute = attribute
				permissions[i].Identifier = identifier

				// TODO: batch update
				_, err := sess.Exec("UPDATE permission SET kind = ?, attribute = ?, identifier = ? WHERE id = ?", permissions[i].Kind, permissions[i].Attribute, permissions[i].Identifier, permissions[i].ID)
				if err != nil {
					return err
				}
			}

			return nil

	*/
	return nil
}

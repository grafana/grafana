package migrator

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// TODO: perform updates in a more efficient way
// TODO: should we feature flag this?
func MigrateScopeSplit(db db.DB, log log.Logger) error {
	t := time.Now()
	var count = 0
	err := db.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		// TODO: DROP INDEXES IF EXISTS?
		var permissions []accesscontrol.Permission

		sess.SQL("SELECT * FROM permission WHERE NOT scope = '' AND kind = '' AND attribute = '' AND identifier = ''").Find(&permissions)

		for i, p := range permissions {
			count++
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
	})

	log.Debug("Migrated permissions ", "count", count, "in", time.Since(t))

	return err
}

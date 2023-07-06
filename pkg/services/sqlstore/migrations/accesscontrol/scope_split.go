package accesscontrol

import (
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func AddScopeSplitMigrations(mg *migrator.Migrator) {
	permissionTable := migrator.Table{Name: "permission"}
	mg.AddMigration("permission kind migration", migrator.NewAddColumnMigration(permissionTable, &migrator.Column{
		Name: "kind", Type: migrator.DB_NVarchar, Length: 100, Default: "''",
	}))

	mg.AddMigration("permission attribute migration", migrator.NewAddColumnMigration(permissionTable, &migrator.Column{
		Name: "attribute", Type: migrator.DB_NVarchar, Length: 100, Default: "''",
	}))

	mg.AddMigration("permission identifier migration", migrator.NewAddColumnMigration(permissionTable, &migrator.Column{
		Name: "identifier", Type: migrator.DB_NVarchar, Length: 100, Default: "''",
	}))

	mg.AddMigration("permission scope split migration", &scopeSplitMigrator{})
	mg.AddMigration("add permission kind_attribute_identifier index", migrator.NewAddIndexMigration(permissionTable, &migrator.Index{
		Cols: []string{"kind", "attribute", "identifier"},
	}))
}

type scopeSplitMigrator struct {
	migrator.MigrationBase
}

func (m *scopeSplitMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (m *scopeSplitMigrator) Exec(sess *xorm.Session, mig *migrator.Migrator) error {
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
}

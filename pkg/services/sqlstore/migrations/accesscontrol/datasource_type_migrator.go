package accesscontrol

import (
	"fmt"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// DatasourceTypeMigrationID is the migration_log id for the datasource_type backfill.
const DatasourceTypeMigrationID = "populate datasource_type in permission table for uid-scoped datasource permissions"

func AddDatasourceTypeMigration(mg *migrator.Migrator) {
	mg.AddMigration(DatasourceTypeMigrationID, &datasourceTypeMigrator{})
}

type datasourceTypeMigrator struct {
	migrator.MigrationBase
}

var _ migrator.CodeMigration = new(datasourceTypeMigrator)

func (m *datasourceTypeMigrator) SQL(_ migrator.Dialect) string {
	return CodeMigrationSQL
}

const backfillDatasourceTypeSQL = `
UPDATE permission AS p
SET datasource_type = (
	SELECT ds.type
	FROM data_source AS ds
	INNER JOIN role AS r ON r.id = p.role_id
	WHERE ds.uid = p.identifier AND ds.org_id = r.org_id
	LIMIT 1
)
WHERE p.kind = 'datasources' AND p.attribute = 'uid'`

// Exec populates the datasource_type column on permission rows that are scoped
// to a specific datasource UID (kind='datasources', attribute='uid')
func (m *datasourceTypeMigrator) Exec(sess *xorm.Session, _ *migrator.Migrator) error {
	if _, err := sess.Exec(backfillDatasourceTypeSQL); err != nil {
		return fmt.Errorf("failed to backfill permission.datasource_type: %w", err)
	}
	return nil
}

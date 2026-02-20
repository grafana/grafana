package migrations

import (
	"fmt"
	"strings"

	"github.com/bwmarrin/snowflake"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func initResourceTables(mg *migrator.Migrator) string {
	marker := "Initialize resource tables"
	mg.AddMigration(marker, &migrator.RawSQLMigration{})

	resource_table := migrator.Table{
		Name: "resource",
		Columns: []*migrator.Column{
			// primary identifier
			{Name: "guid", Type: migrator.DB_NVarchar, Length: 36, Nullable: false, IsPrimaryKey: true},

			{Name: "resource_version", Type: migrator.DB_BigInt, Nullable: true},

			// K8s Identity group+(version)+namespace+resource+name
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 63, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "value", Type: migrator.DB_LongText, Nullable: true},
			{Name: "action", Type: migrator.DB_Int, Nullable: false}, // 1: create, 2: update, 3: delete

			// Hashed label set
			{Name: "label_set", Type: migrator.DB_NVarchar, Length: 64, Nullable: true}, // null is no labels
		},
		Indices: []*migrator.Index{
			{Cols: []string{"namespace", "group", "resource", "name"}, Type: migrator.UniqueIndex},
		},
	}
	resource_history_table := migrator.Table{
		Name: "resource_history",
		Columns: []*migrator.Column{
			// primary identifier
			{Name: "guid", Type: migrator.DB_NVarchar, Length: 36, Nullable: false, IsPrimaryKey: true},
			{Name: "resource_version", Type: migrator.DB_BigInt, Nullable: true},

			// K8s Identity group+(version)+namespace+resource+name
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 63, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 253, Nullable: false},
			{Name: "value", Type: migrator.DB_LongText, Nullable: true},
			{Name: "action", Type: migrator.DB_Int, Nullable: false}, // 1: create, 2: update, 3: delete

			// Hashed label set
			{Name: "label_set", Type: migrator.DB_NVarchar, Length: 64, Nullable: true}, // null is no labels
		},
		Indices: []*migrator.Index{
			{
				Cols: []string{"namespace", "group", "resource", "name", "resource_version"},
				Type: migrator.UniqueIndex,
				Name: "UQE_resource_history_namespace_group_name_version",
			},
			// index to support watch poller
			{Cols: []string{"resource_version"}, Type: migrator.IndexType},
		},
	}

	tables := []migrator.Table{resource_table, resource_history_table} //nolint:prealloc

	// tables = append(tables, migrator.Table{
	// 	Name: "resource_label_set",
	// 	Columns: []*migrator.Column{
	// 		{Name: "label_set", Type: migrator.DB_NVarchar, Length: 64, Nullable: false},
	// 		{Name: "label", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
	// 		{Name: "value", Type: migrator.DB_Text, Nullable: false},
	// 	},
	// 	Indices: []*migrator.Index{
	// 		{Cols: []string{"label_set", "label"}, Type: migrator.UniqueIndex},
	// 	},
	// })

	tables = append(tables, migrator.Table{
		Name: "resource_version",
		Columns: []*migrator.Column{
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource_version", Type: migrator.DB_BigInt, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"group", "resource"}, Type: migrator.UniqueIndex},
		},
	})

	tables = append(tables, migrator.Table{
		Name: "resource_blob",
		Columns: []*migrator.Column{
			{Name: "uuid", Type: migrator.DB_Uuid, Length: 36, Nullable: false, IsPrimaryKey: true},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},

			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 63, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 253, Nullable: false},

			// The raw bytes
			{Name: "value", Type: migrator.DB_LongBlob, Nullable: false},

			// Used as an etag
			{Name: "hash", Type: migrator.DB_NVarchar, Length: 64, Nullable: false},
			{Name: "content_type", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
		},
		Indices: []*migrator.Index{
			{
				Cols: []string{"namespace", "group", "resource", "name"},
				Type: migrator.IndexType,
				Name: "IDX_resource_history_namespace_group_name",
			},
			{Cols: []string{"created"}, Type: migrator.IndexType}, // sort field
		},
	})

	resource_last_import_time := migrator.Table{
		Name: "resource_last_import_time",
		Columns: []*migrator.Column{
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 63, Nullable: false},
			{Name: "last_import_time", Type: migrator.DB_DateTime, Nullable: false},
		},
		PrimaryKeys: []string{"group", "resource", "namespace"},
	}
	tables = append(tables, resource_last_import_time)

	// Initialize all tables
	for t := range tables {
		mg.AddMigration("drop table "+tables[t].Name, migrator.NewDropTableMigration(tables[t].Name))
		mg.AddMigration("create table "+tables[t].Name, migrator.NewAddTableMigration(tables[t]))
		for i := range tables[t].Indices {
			mg.AddMigration(fmt.Sprintf("create table %s, index: %d", tables[t].Name, i), migrator.NewAddIndexMigration(tables[t], tables[t].Indices[i]))
		}
	}

	mg.AddMigration("Add column previous_resource_version in resource_history", migrator.NewAddColumnMigration(resource_history_table, &migrator.Column{
		Name: "previous_resource_version", Type: migrator.DB_BigInt, Nullable: true,
	}))

	mg.AddMigration("Add column previous_resource_version in resource", migrator.NewAddColumnMigration(resource_table, &migrator.Column{
		Name: "previous_resource_version", Type: migrator.DB_BigInt, Nullable: true,
	}))

	mg.AddMigration("Add index to resource_history for polling", migrator.NewAddIndexMigration(resource_history_table, &migrator.Index{
		Cols: []string{"group", "resource", "resource_version"}, Type: migrator.IndexType,
	}))

	mg.AddMigration("Add index to resource for loading", migrator.NewAddIndexMigration(resource_table, &migrator.Index{
		Cols: []string{"group", "resource"}, Type: migrator.IndexType,
	}))

	mg.AddMigration("Add column folder in resource_history", migrator.NewAddColumnMigration(resource_history_table, &migrator.Column{
		Name: "folder", Type: migrator.DB_NVarchar, Length: 253, Nullable: false, Default: "''",
	}))

	mg.AddMigration("Add column folder in resource", migrator.NewAddColumnMigration(resource_table, &migrator.Column{
		Name: "folder", Type: migrator.DB_NVarchar, Length: 253, Nullable: false, Default: "''",
	}))

	mg.AddMigration("Migrate DeletionMarkers to real Resource objects", &deletionMarkerMigrator{})

	mg.AddMigration("Add index to resource_history for get trash", migrator.NewAddIndexMigration(resource_history_table, &migrator.Index{
		Name: "IDX_resource_history_namespace_group_resource_action_version",
		Cols: []string{"namespace", "group", "resource", "action", "resource_version"},
		Type: migrator.IndexType,
	}))

	// Add generation column so we can use it for more aggressive pruning
	mg.AddMigration("Add generation to resource history", migrator.NewAddColumnMigration(resource_history_table, &migrator.Column{
		Name: "generation", Type: migrator.DB_BigInt, Nullable: false, Default: "0",
	}))
	mg.AddMigration("Add generation index to resource history", migrator.NewAddIndexMigration(resource_history_table, &migrator.Index{
		Cols: []string{"namespace", "group", "resource", "name", "generation"},
		Type: migrator.IndexType,
		Name: "IDX_resource_history_namespace_group_resource_name_generation",
	}))

	mg.AddMigration("Add UQE_resource_last_import_time_last_import_time index", migrator.NewAddIndexMigration(resource_last_import_time, &migrator.Index{
		Cols: []string{"last_import_time"},
		Type: migrator.IndexType,
		Name: "UQE_resource_last_import_time_last_import_time",
	}))

	mg.AddMigration("Add key_path column to resource_history", migrator.NewAddColumnMigration(resource_history_table, &migrator.Column{
		Name: "key_path", Type: migrator.DB_NVarchar, Length: 2048, Nullable: false, Default: "''", IsLatin: true,
	}))

	resource_events_table := migrator.Table{
		Name: "resource_events",
		Columns: []*migrator.Column{
			{Name: "key_path", Type: migrator.DB_NVarchar, Length: 2048, Nullable: false, IsPrimaryKey: true, IsLatin: true},
			{Name: "value", Type: migrator.DB_MediumText, Nullable: false},
		},
	}
	mg.AddMigration("create table "+resource_events_table.Name, migrator.NewAddTableMigration(resource_events_table))

	mg.AddMigration("Add IDX_resource_history_key_path index", migrator.NewAddIndexMigration(resource_history_table, &migrator.Index{
		Cols: []string{"key_path"},
		Type: migrator.IndexType,
		Name: "IDX_resource_history_key_path",
	}))

	oldResourceVersionUniqueKey := migrator.Index{Cols: []string{"group", "resource"}, Type: migrator.UniqueIndex}
	updatedResourceVersionTable := migrator.Table{
		Name: "resource_version",
		Columns: []*migrator.Column{
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false, IsPrimaryKey: true},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false, IsPrimaryKey: true},
			{Name: "resource_version", Type: migrator.DB_BigInt, Nullable: false},
		},
		PrimaryKeys: []string{"group", "resource"},
	}

	migrator.ConvertUniqueKeyToPrimaryKey(mg, oldResourceVersionUniqueKey, updatedResourceVersionTable)

	mg.AddMigration("Change key_path collation of resource_history in postgres", migrator.NewRawSQLMigration("").Postgres(`ALTER TABLE resource_history ALTER COLUMN key_path TYPE VARCHAR(2048) COLLATE "C";`))
	mg.AddMigration("Change key_path collation of resource_events in postgres", migrator.NewRawSQLMigration("").Postgres(`ALTER TABLE resource_events ALTER COLUMN key_path TYPE VARCHAR(2048) COLLATE "C";`))

	mg.AddMigration("resource_history key_path backfill", &ResourceHistoryKeyPathBackfillMigration{})

	mg.AddMigration("Add index to resource_history for garbage collection", migrator.NewAddIndexMigration(resource_history_table, &migrator.Index{
		Cols: []string{"group", "resource", "action", "resource_version", "name"},
		Type: migrator.IndexType,
		Name: "IDX_resource_history_resource_action_version_name",
	}))

	mg.AddMigration("Fix small resource versions", &SmallRVFixMigration{})

	return marker
}

type ResourceHistoryKeyPathBackfillMigration struct {
	migrator.MigrationBase
}

func (m *ResourceHistoryKeyPathBackfillMigration) SQL(_ migrator.Dialect) string {
	return "resource_history key_path backfill code migration"
}

func (m *ResourceHistoryKeyPathBackfillMigration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	rows, err := getResourceHistoryRows(sess, mg, resourceHistoryRow{})
	if err != nil {
		return err
	}

	for len(rows) > 0 {
		if err := updateResourceHistoryKeyPath(sess, rows); err != nil {
			return err
		}

		rows, err = getResourceHistoryRows(sess, mg, rows[len(rows)-1])
		if err != nil {
			return err
		}
	}

	return nil
}

func updateResourceHistoryKeyPath(sess *xorm.Session, rows []resourceHistoryRow) error {
	if len(rows) == 0 {
		return nil
	}

	updates := []resourceHistoryRow{}

	for _, row := range rows {
		if row.KeyPath == "" {
			row.KeyPath = parseKeyPath(row)
			updates = append(updates, row)
		}
	}

	if len(updates) == 0 {
		return nil
	}

	guids := ""
	setCases := "CASE"
	for _, row := range updates {
		guids += fmt.Sprintf("'%s',", row.GUID)
		setCases += fmt.Sprintf(" WHEN guid = '%s' THEN '%s'", row.GUID, row.KeyPath)
	}

	guids = strings.TrimRight(guids, ",")
	setCases += " ELSE key_path END "

	// the query will look like this
	// UPDATE resource_history
	// SET key_path = CASE
	//   WHEN guid = '1402de51-669b-4206-8a6c-005a00eee6e3' then 'unified/data/folder.grafana.app/folders/default/cf6lylpvls000c/1998492888241012800~created~'
	//   WHEN guid = '8842cc56-f22b-45e1-82b1-99759cd443b3' then 'unified/data/dashboard.grafana.app/dashboards/default/adzvfhp/1998492902577144677~created~cf6lylpvls000c'
	//   ELSE key_path END
	// WHERE guid IN ('1402de51-669b-4206-8a6c-005a00eee6e3', '8842cc56-f22b-45e1-82b1-99759cd443b3')
	// AND key_path = '';
	sql := fmt.Sprintf(`
	UPDATE resource_history
	SET key_path = %s
	WHERE guid IN (%s)
	AND key_path = '';
	`, setCases, guids)

	if _, err := sess.Exec(sql); err != nil {
		return err
	}

	return nil
}

func parseKeyPath(row resourceHistoryRow) string {
	var action string
	switch row.Action {
	case 1:
		action = "created"
	case 2:
		action = "updated"
	case 3:
		action = "deleted"
	}
	return fmt.Sprintf("unified/data/%s/%s/%s/%s/%d~%s~%s", row.Group, row.Resource, row.Namespace, row.Name, snowflakeFromRv(row.ResourceVersion), action, row.Folder)
}

func snowflakeFromRv(rv int64) int64 {
	return (((rv / 1000) - snowflake.Epoch) << (snowflake.NodeBits + snowflake.StepBits)) + (rv % 1000)
}

type resourceHistoryRow struct {
	GUID            string `xorm:"guid"`
	Group           string `xorm:"group"`
	Resource        string `xorm:"resource"`
	Namespace       string `xorm:"namespace"`
	Name            string `xorm:"name"`
	ResourceVersion int64  `xorm:"resource_version"`
	Action          int64  `xorm:"action"`
	Folder          string `xorm:"folder"`
	KeyPath         string `xorm:"key_path"`
}

func getResourceHistoryRows(sess *xorm.Session, mg *migrator.Migrator, continueRow resourceHistoryRow) ([]resourceHistoryRow, error) {
	var rows []resourceHistoryRow
	cols := fmt.Sprintf(
		"%s, %s, %s, %s, %s, %s, %s, %s, %s",
		mg.Dialect.Quote("guid"),
		mg.Dialect.Quote("group"),
		mg.Dialect.Quote("resource"),
		mg.Dialect.Quote("namespace"),
		mg.Dialect.Quote("name"),
		mg.Dialect.Quote("resource_version"),
		mg.Dialect.Quote("action"),
		mg.Dialect.Quote("folder"),
		mg.Dialect.Quote("key_path"))
	sql := fmt.Sprintf(`
		SELECT %s
		FROM resource_history
		WHERE (resource_version > %d OR (resource_version = %d AND guid > '%s'))
		AND key_path = ''
		ORDER BY resource_version ASC, guid ASC
		LIMIT 1000;
	`, cols, continueRow.ResourceVersion, continueRow.ResourceVersion, continueRow.GUID)
	if err := sess.SQL(sql).Find(&rows); err != nil {
		return nil, err
	}

	return rows, nil
}

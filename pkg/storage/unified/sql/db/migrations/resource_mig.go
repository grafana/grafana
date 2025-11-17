package migrations

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
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

	tables := []migrator.Table{resource_table, resource_history_table}

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

	// TODO: Do we want the value to be MEDIUMTEXT ?
	// TODO: What's the best name for the key_path column?

	// Add key_path column to resource_history for KV interface
	mg.AddMigration("Add key_path column to resource_history", migrator.NewAddColumnMigration(resource_history_table, &migrator.Column{
		Name: "key_path", Type: migrator.DB_NVarchar, Length: 2048, Nullable: true,
	}))

	// Backfill key_path column in resource_history
	mg.AddMigration("Backfill key_path column in resource_history", &resourceHistoryKeyBackfillMigrator{})

	// Note: key_path remains nullable because the write pattern is:
	// 1. INSERT (key_path = NULL)
	// 2. UPDATE (key_path = actual value after RV allocation)

	// Add index on key_path column
	mg.AddMigration("Add index on key_path column in resource_history", migrator.NewAddIndexMigration(resource_history_table, &migrator.Index{
		Name: "IDX_resource_history_key_path",
		Cols: []string{"key_path"},
		Type: migrator.IndexType,
	}))

	// Create resource_events table for KV interface
	resource_events_table := migrator.Table{
		Name: "resource_events",
		Columns: []*migrator.Column{
			{Name: "key_path", Type: migrator.DB_NVarchar, Length: 2048, Nullable: false, IsPrimaryKey: true},
			{Name: "value", Type: migrator.DB_MediumText, Nullable: false},
		},
	}
	mg.AddMigration("create table "+resource_events_table.Name, migrator.NewAddTableMigration(resource_events_table))

	return marker
}

// resourceHistoryKeyBackfillMigrator backfills the key_path column in resource_history table
// It processes rows in batches to reduce lock duration and avoid timeouts on large tables
type resourceHistoryKeyBackfillMigrator struct {
	migrator.MigrationBase
}

func (m *resourceHistoryKeyBackfillMigrator) SQL(dialect migrator.Dialect) string {
	return "Backfill key_path column in resource_history using pattern: {Group}/{Resource}/{Namespace}/{Name}/{ResourceVersion}~{Action}~{Folder}"
}

func (m *resourceHistoryKeyBackfillMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	dialect := mg.Dialect.DriverName()
	logger := log.New("resource-history-key-backfill")

	// TODO: Verify the RV to Snowflake ID conversion is correct.

	// Snowflake ID epoch in milliseconds (2010-11-04T01:42:54.657Z)
	const epochMs = 1288834974657
	const batchSize = 1000 // Process 1000 rows at a time

	// Count total rows to backfill
	totalCount, err := sess.Table("resource_history").Where("key_path IS NULL").Count()
	if err != nil {
		return fmt.Errorf("failed to count rows: %w", err)
	}

	if totalCount == 0 {
		logger.Info("No rows to backfill")
		return nil
	}

	logger.Info("Starting key_path backfill", "total_rows", totalCount)

	// Build the SQL query based on the database dialect
	var updateSQL string

	switch dialect {
	case "mysql":
		updateSQL = `
			UPDATE resource_history 
			SET key_path = CONCAT(
				` + "`group`" + `, '/', 
				` + "`resource`" + `, '/', 
				` + "`namespace`" + `, '/', 
				` + "`name`" + `, '/', 
				CAST((((` + "`resource_version`" + ` DIV 1000) - ?) * 4194304) + (` + "`resource_version`" + ` MOD 1000) AS CHAR), '~', 
				CASE ` + "`action`" + `
					WHEN 1 THEN 'created' 
					WHEN 2 THEN 'updated' 
					WHEN 3 THEN 'deleted' 
					ELSE 'unknown'
				END, '~', 
				COALESCE(` + "`folder`" + `, '')
			)
			WHERE key_path IS NULL
			LIMIT ?
		`
	case "postgres":
		updateSQL = `
			UPDATE resource_history 
			SET key_path = CONCAT(
				"group", '/', 
				"resource", '/', 
				"namespace", '/', 
				"name", '/', 
				CAST((((resource_version / 1000) - $1) * 4194304) + (resource_version % 1000) AS BIGINT), '~', 
				CASE "action" 
					WHEN 1 THEN 'created' 
					WHEN 2 THEN 'updated' 
					WHEN 3 THEN 'deleted' 
					ELSE 'unknown'
				END, '~', 
				COALESCE("folder", '')
			)
			WHERE guid IN (
				SELECT guid FROM resource_history 
				WHERE key_path IS NULL 
				LIMIT $2
			)
		`
	case "sqlite3":
		updateSQL = `
			UPDATE resource_history 
			SET key_path = 
				"group" || '/' || 
				resource || '/' || 
				namespace || '/' || 
				name || '/' || 
				CAST((((resource_version / 1000) - ?) * 4194304) + (resource_version % 1000) AS TEXT) || '~' || 
				CASE action 
					WHEN 1 THEN 'created' 
					WHEN 2 THEN 'updated' 
					WHEN 3 THEN 'deleted' 
					ELSE 'unknown'
				END || '~' || 
				COALESCE(folder, '')
			WHERE guid IN (
				SELECT guid FROM resource_history 
				WHERE key_path IS NULL 
				LIMIT ?
			)
		`
	default:
		return fmt.Errorf("unsupported database dialect: %s", dialect)
	}

	// Process in batches
	processed := int64(0)
	for {
		result, err := sess.Exec(updateSQL, epochMs, batchSize)
		if err != nil {
			return fmt.Errorf("failed to update batch: %w", err)
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return fmt.Errorf("failed to get rows affected: %w", err)
		}

		processed += rowsAffected
		logger.Info("Backfill progress", "processed", processed, "total", totalCount,
			"percent", fmt.Sprintf("%.1f%%", float64(processed)/float64(totalCount)*100))

		// If we updated fewer rows than batch size, we're done
		if rowsAffected < int64(batchSize) {
			break
		}
	}

	logger.Info("Backfill completed", "total_processed", processed)
	return nil
}

package migrations

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

func getLatinPathColumn(name string) *migrator.Column {
	return &migrator.Column{
		Name:     name,
		Type:     migrator.DB_NVarchar,
		Length:   1024,
		Nullable: false,
		IsLatin:  true, // only used in MySQL
	}
}

func addEntityStoreMigrations(mg *migrator.Migrator) {
	grnLength := 256 // len(tenant)~8 + len(kind)!16 + len(kind)~128 = 256
	tables := []migrator.Table{}
	tables = append(tables, migrator.Table{
		Name: "entity",
		Columns: []*migrator.Column{
			// Object ID (OID) will be unique across all objects/instances
			// uuid5( tenant_id, kind + uid )
			{Name: "grn", Type: migrator.DB_NVarchar, Length: grnLength, Nullable: false, IsPrimaryKey: true},

			// The entity identifier
			{Name: "tenant_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "kind", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "folder", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "access", Type: migrator.DB_Text, Nullable: true}, // JSON object

			// The raw entity body (any byte array)
			{Name: "body", Type: migrator.DB_LongBlob, Nullable: true}, // null when nested or remote
			{Name: "size", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "etag", Type: migrator.DB_NVarchar, Length: 32, Nullable: false, IsLatin: true}, // md5(body)
			{Name: "version", Type: migrator.DB_NVarchar, Length: 128, Nullable: false},

			// Who changed what when -- We should avoid JOINs with other tables in the database
			{Name: "updated_at", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "created_at", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "updated_by", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "created_by", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},

			// Mark objects with origin metadata
			{Name: "origin", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			getLatinPathColumn("origin_key"), // index with length 1024
			{Name: "origin_ts", Type: migrator.DB_BigInt, Nullable: false},

			// Summary data (always extracted from the `body` column)
			{Name: "name", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "description", Type: migrator.DB_NVarchar, Length: 255, Nullable: true},
			{Name: "slug", Type: migrator.DB_NVarchar, Length: 189, Nullable: false}, // from title
			{Name: "labels", Type: migrator.DB_Text, Nullable: true},                 // JSON object
			{Name: "fields", Type: migrator.DB_Text, Nullable: true},                 // JSON object
			{Name: "errors", Type: migrator.DB_Text, Nullable: true},                 // JSON object
		},
		Indices: []*migrator.Index{
			{Cols: []string{"kind"}},
			{Cols: []string{"folder"}},
			{Cols: []string{"uid"}},

			{Cols: []string{"tenant_id", "kind", "uid"}, Type: migrator.UniqueIndex},
			// {Cols: []string{"tenant_id", "folder", "slug"}, Type: migrator.UniqueIndex},
		},
	})

	// when saving a folder, keep a path version cached (all info is derived from entity table)
	tables = append(tables, migrator.Table{
		Name: "entity_folder",
		Columns: []*migrator.Column{
			{Name: "grn", Type: migrator.DB_NVarchar, Length: grnLength, Nullable: false, IsPrimaryKey: true},
			{Name: "tenant_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			getLatinPathColumn("slug_path"),                             ///slug/slug/slug/
			{Name: "tree", Type: migrator.DB_Text, Nullable: false},     // JSON []{uid, title}
			{Name: "depth", Type: migrator.DB_Int, Nullable: false},     // starts at 1
			{Name: "left", Type: migrator.DB_Int, Nullable: false},      // MPTT
			{Name: "right", Type: migrator.DB_Int, Nullable: false},     // MPTT
			{Name: "detached", Type: migrator.DB_Bool, Nullable: false}, // a parent folder was not found
		},
		Indices: []*migrator.Index{
			{Cols: []string{"tenant_id", "uid"}, Type: migrator.UniqueIndex},
			//	{Cols: []string{"tenant_id", "slug_path"}, Type: migrator.UniqueIndex},
		},
	})

	tables = append(tables, migrator.Table{
		Name: "entity_labels",
		Columns: []*migrator.Column{
			{Name: "grn", Type: migrator.DB_NVarchar, Length: grnLength, Nullable: false},
			{Name: "label", Type: migrator.DB_NVarchar, Length: 191, Nullable: false},
			{Name: "value", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},
			{Name: "parent_grn", Type: migrator.DB_NVarchar, Length: grnLength, Nullable: true},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"grn", "label"}, Type: migrator.UniqueIndex},
			{Cols: []string{"parent_grn"}, Type: migrator.IndexType},
		},
	})

	tables = append(tables, migrator.Table{
		Name: "entity_ref",
		Columns: []*migrator.Column{
			// Source:
			{Name: "grn", Type: migrator.DB_NVarchar, Length: grnLength, Nullable: false},
			{Name: "parent_grn", Type: migrator.DB_NVarchar, Length: grnLength, Nullable: true},

			// Address (defined in the body, not resolved, may be invalid and change)
			{Name: "family", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "type", Type: migrator.DB_NVarchar, Length: 255, Nullable: true},
			{Name: "id", Type: migrator.DB_NVarchar, Length: 1024, Nullable: true},

			// Runtime calcs (will depend on the system state)
			{Name: "resolved_ok", Type: migrator.DB_Bool, Nullable: false},
			{Name: "resolved_to", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "resolved_warning", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "resolved_time", Type: migrator.DB_DateTime, Nullable: false}, // resolution cache timestamp
		},
		Indices: []*migrator.Index{
			{Cols: []string{"grn"}, Type: migrator.IndexType},
			{Cols: []string{"family"}, Type: migrator.IndexType},
			{Cols: []string{"type"}, Type: migrator.IndexType},
			{Cols: []string{"resolved_to"}, Type: migrator.IndexType},
			{Cols: []string{"parent_grn"}, Type: migrator.IndexType},
		},
	})

	tables = append(tables, migrator.Table{
		Name: "entity_history",
		Columns: []*migrator.Column{
			{Name: "grn", Type: migrator.DB_NVarchar, Length: grnLength, Nullable: false},
			{Name: "version", Type: migrator.DB_NVarchar, Length: 128, Nullable: false},

			// Raw bytes
			{Name: "folder", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "access", Type: migrator.DB_Text, Nullable: true}, // JSON object
			{Name: "body", Type: migrator.DB_LongBlob, Nullable: false},
			{Name: "size", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "etag", Type: migrator.DB_NVarchar, Length: 32, Nullable: false, IsLatin: true}, // md5(body)

			// Who changed what when
			{Name: "updated_at", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "updated_by", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},

			// Commit message
			{Name: "message", Type: migrator.DB_Text, Nullable: false}, // defaults to empty string
		},
		Indices: []*migrator.Index{
			{Cols: []string{"grn", "version"}, Type: migrator.UniqueIndex},
			{Cols: []string{"updated_by"}, Type: migrator.IndexType},
		},
	})

	tables = append(tables, migrator.Table{
		Name: "entity_nested",
		Columns: []*migrator.Column{
			{Name: "grn", Type: migrator.DB_NVarchar, Length: grnLength, Nullable: false, IsPrimaryKey: true},
			{Name: "parent_grn", Type: migrator.DB_NVarchar, Length: grnLength, Nullable: false},

			// The entity identifier
			{Name: "tenant_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "kind", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "folder", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},

			// Summary data (always extracted from the `body` column)
			{Name: "name", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "description", Type: migrator.DB_NVarchar, Length: 255, Nullable: true},
			{Name: "labels", Type: migrator.DB_Text, Nullable: true}, // JSON object
			{Name: "fields", Type: migrator.DB_Text, Nullable: true}, // JSON object
			{Name: "errors", Type: migrator.DB_Text, Nullable: true}, // JSON object
		},
		Indices: []*migrator.Index{
			{Cols: []string{"parent_grn"}},
			{Cols: []string{"kind"}},
			{Cols: []string{"folder"}},
			{Cols: []string{"uid"}},
			{Cols: []string{"tenant_id", "kind", "uid"}, Type: migrator.UniqueIndex},
		},
	})

	tables = append(tables, migrator.Table{
		Name: "entity_access",
		Columns: []*migrator.Column{
			{Name: "grn", Type: migrator.DB_NVarchar, Length: grnLength, Nullable: false},
			{Name: "role", Type: migrator.DB_NVarchar, Length: 32, Nullable: false},
			{Name: "action", Type: migrator.DB_NVarchar, Length: 32, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"grn", "role", "action"}, Type: migrator.UniqueIndex},
		},
	})

	// !!! This should not run in production!
	// The object store SQL schema is still in active development and this
	// will only be called when the feature toggle is enabled
	// this check should not be necessary, but is added as an extra check
	if setting.Env == setting.Prod {
		return
	}

	// Migration cleanups: given that this is a complex setup
	// that requires a lot of testing before we are ready to push out of dev
	// this script lets us easy wipe previous changes and initialize clean tables
	suffix := " (v22)" // change this when we want to wipe and reset the object tables
	mg.AddMigration("EntityStore init: cleanup"+suffix, migrator.NewRawSQLMigration(strings.TrimSpace(`
		DELETE FROM migration_log WHERE migration_id LIKE 'EntityStore init%';
	`)))
	// for a while this was called "ObjectStore"... this can be removed before we remove the dev only flags
	mg.AddMigration("EntityStore init: object cleanup"+suffix, migrator.NewRawSQLMigration(strings.TrimSpace(`
		DELETE FROM migration_log WHERE migration_id LIKE 'ObjectStore init%';
	`)))

	// Initialize all tables
	for t := range tables {
		mg.AddMigration("EntityStore init: drop "+tables[t].Name+suffix, migrator.NewRawSQLMigration(
			fmt.Sprintf("DROP TABLE IF EXISTS %s", tables[t].Name),
		))
		mg.AddMigration("EntityStore init: table "+tables[t].Name+suffix, migrator.NewAddTableMigration(tables[t]))
		for i := range tables[t].Indices {
			mg.AddMigration(fmt.Sprintf("EntityStore init: index %s[%d]"+suffix, tables[t].Name, i), migrator.NewAddIndexMigration(tables[t], tables[t].Indices[i]))
		}
	}

	mg.AddMigration("EntityStore init: set path collation in entity tables"+suffix, migrator.NewRawSQLMigration("").
		// MySQL `utf8mb4_unicode_ci` collation is set in `mysql_dialect.go`
		// SQLite uses a `BINARY` collation by default
		Postgres("ALTER TABLE entity_folder ALTER COLUMN slug_path TYPE VARCHAR(1024) COLLATE \"C\";")) // Collate C - sorting done based on character code byte values
}

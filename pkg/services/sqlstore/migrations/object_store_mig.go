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

func addObjectStorageMigrations(mg *migrator.Migrator) {
	oidLength := 96 // 40 + len(kind) + len(tenant)
	tables := []migrator.Table{}
	tables = append(tables, migrator.Table{
		Name: "object",
		Columns: []*migrator.Column{
			// Object ID (OID) will be unique across all objects/instances
			// uuid5( tenant_id, kind + uid )
			{Name: "oid", Type: migrator.DB_NVarchar, Length: oidLength, Nullable: false, IsPrimaryKey: true},

			// The object identifier
			{Name: "tenant_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "kind", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "folder", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "slug", Type: migrator.DB_NVarchar, Length: 189, Nullable: false}, // from title

			// The raw object body (any byte array)
			{Name: "body", Type: migrator.DB_LongBlob, Nullable: false},
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
			{Name: "labels", Type: migrator.DB_Text, Nullable: true}, // JSON object
			{Name: "fields", Type: migrator.DB_Text, Nullable: true}, // JSON object
			{Name: "errors", Type: migrator.DB_Text, Nullable: true}, // JSON object
		},
		Indices: []*migrator.Index{
			{Cols: []string{"kind"}},
			{Cols: []string{"folder"}},
			{Cols: []string{"uid"}},

			{Cols: []string{"tenant_id", "kind", "uid"}, Type: migrator.UniqueIndex},
			// {Cols: []string{"tenant_id", "folder", "slug"}, Type: migrator.UniqueIndex},
		},
	})

	// when saving a folder, keep a path version cached
	tables = append(tables, migrator.Table{
		Name: "object_folder",
		Columns: []*migrator.Column{
			{Name: "oid", Type: migrator.DB_NVarchar, Length: oidLength, Nullable: false},
			getLatinPathColumn("path"), // slug/slug/slug/...
			{Name: "depth", Type: migrator.DB_Int, Nullable: false},
			{Name: "tree", Type: migrator.DB_Text, Nullable: false}, // JSON array from root
		},
		Indices: []*migrator.Index{
			{Cols: []string{"path"}, Type: migrator.UniqueIndex},
		},
	})

	tables = append(tables, migrator.Table{
		Name: "object_labels",
		Columns: []*migrator.Column{
			{Name: "oid", Type: migrator.DB_NVarchar, Length: oidLength, Nullable: false},
			{Name: "label", Type: migrator.DB_NVarchar, Length: 191, Nullable: false},
			{Name: "value", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"oid", "label"}, Type: migrator.UniqueIndex},
		},
	})

	tables = append(tables, migrator.Table{
		Name: "object_ref",
		Columns: []*migrator.Column{
			// Source:
			{Name: "oid", Type: migrator.DB_NVarchar, Length: oidLength, Nullable: false},

			// Address (defined in the body, not resolved, may be invalid and change)
			{Name: "kind", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "type", Type: migrator.DB_NVarchar, Length: 255, Nullable: true},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 1024, Nullable: true},

			// Runtime calcs (will depend on the system state)
			{Name: "resolved_ok", Type: migrator.DB_Bool, Nullable: false},
			{Name: "resolved_to", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "resolved_warning", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "resolved_time", Type: migrator.DB_DateTime, Nullable: false}, // resolution cache timestamp
		},
		Indices: []*migrator.Index{
			{Cols: []string{"oid"}, Type: migrator.IndexType},
			{Cols: []string{"kind"}, Type: migrator.IndexType},
			{Cols: []string{"resolved_to"}, Type: migrator.IndexType},
		},
	})

	tables = append(tables, migrator.Table{
		Name: "object_history",
		Columns: []*migrator.Column{
			{Name: "oid", Type: migrator.DB_NVarchar, Length: oidLength, Nullable: false},
			{Name: "version", Type: migrator.DB_NVarchar, Length: 128, Nullable: false},

			// Raw bytes
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
			{Cols: []string{"oid", "version"}, Type: migrator.UniqueIndex},
			{Cols: []string{"updated_by"}, Type: migrator.IndexType},
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
	suffix := " (v5)" // change this when we want to wipe and reset the object tables
	mg.AddMigration("ObjectStore init: cleanup"+suffix, migrator.NewRawSQLMigration(strings.TrimSpace(`
		DELETE FROM migration_log WHERE migration_id LIKE 'ObjectStore init%';
	`)))

	// Initialize all tables
	for t := range tables {
		mg.AddMigration("ObjectStore init: drop "+tables[t].Name+suffix, migrator.NewRawSQLMigration(
			fmt.Sprintf("DROP TABLE IF EXISTS %s", tables[t].Name),
		))
		mg.AddMigration("ObjectStore init: table "+tables[t].Name+suffix, migrator.NewAddTableMigration(tables[t]))
		for i := range tables[t].Indices {
			mg.AddMigration(fmt.Sprintf("ObjectStore init: index %s[%d]"+suffix, tables[t].Name, i), migrator.NewAddIndexMigration(tables[t], tables[t].Indices[i]))
		}
	}

	// mg.AddMigration("ObjectStore init: set path collation in object tables"+suffix, migrator.NewRawSQLMigration("").
	// 	// MySQL `utf8mb4_unicode_ci` collation is set in `mysql_dialect.go`
	// 	// SQLite uses a `BINARY` collation by default
	// 	Postgres("ALTER TABLE object_folder ALTER COLUMN path TYPE VARCHAR(1024) COLLATE \"C\";")) // Collate C - sorting done based on character code byte values
}

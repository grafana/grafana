package migrations

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addObjectStorageMigrations(mg *migrator.Migrator) {
	objectTable := migrator.Table{
		Name: "object",
		Columns: []*migrator.Column{
			// Object key contains everything required to make it unique across all instances
			// orgId+kind+uid+scope?
			{Name: "key", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false, IsPrimaryKey: true},

			// If objects are organized into folders (ie '/' exists in the uid),
			// this will optimize the common use case of listing all files in a folder
			{Name: "parent_folder_key", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},

			// The object type
			{Name: "kind", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},

			// The raw object body (any byte array)
			{Name: "body", Type: migrator.DB_Blob, Nullable: false},
			{Name: "size", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "etag", Type: migrator.DB_NVarchar, Length: 32, Nullable: false}, // md5(body)
			{Name: "version", Type: migrator.DB_NVarchar, Length: 128, Nullable: false},

			// Who changed what when
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "created", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated_by", Type: migrator.DB_Int, Nullable: false}, // joined to user table
			{Name: "created_by", Type: migrator.DB_Int, Nullable: false}, // joined to user table

			// For objects that are synchronized from an external source (ie provisioning or git)
			{Name: "sync_src", Type: migrator.DB_Text, Nullable: true},
			{Name: "sync_time", Type: migrator.DB_DateTime, Nullable: true},

			// Summary data (always extracted from the `body` column)
			{Name: "name", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "description", Type: migrator.DB_NVarchar, Length: 255, Nullable: true},
			{Name: "labels", Type: migrator.DB_Text, Nullable: true}, // JSON object
			{Name: "fields", Type: migrator.DB_Text, Nullable: true}, // JSON object
			{Name: "errors", Type: migrator.DB_Text, Nullable: true}, // JSON object
		},
		PrimaryKeys: []string{"key"},
		Indices: []*migrator.Index{
			{Cols: []string{"parent_folder_key"}}, // list in folder
			{Cols: []string{"kind"}},              // filter by type
		},
	}

	objectLabelsTable := migrator.Table{
		Name: "object_labels",
		Columns: []*migrator.Column{
			{Name: "key", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},
			{Name: "label", Type: migrator.DB_NVarchar, Length: 191, Nullable: false},
			{Name: "value", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"key", "label"}, Type: migrator.UniqueIndex},
		},
	}

	objectReferenceTable := migrator.Table{
		Name: "object_ref",
		Columns: []*migrator.Column{
			// Source:
			{Name: "key", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},

			// Address (defined in the body, not resolved, may be invalid and change)
			{Name: "kind", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "type", Type: migrator.DB_NVarchar, Length: 255, Nullable: true},
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 1024, Nullable: true},

			// Runtime calcs (will depend on the system state)
			{Name: "resolved_ok", Type: migrator.DB_Bool, Nullable: false},
			{Name: "resolved_to", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},
			{Name: "resolved_warning", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "resolved_time", Type: migrator.DB_DateTime, Nullable: false}, // resolution cache timestamp
		},
		Indices: []*migrator.Index{
			{Cols: []string{"key"}, Type: migrator.IndexType},
			{Cols: []string{"kind"}, Type: migrator.IndexType},
			{Cols: []string{"resolved_to"}, Type: migrator.IndexType},
		},
	}

	objectHistoryTable := migrator.Table{
		Name: "object_history",
		Columns: []*migrator.Column{
			{Name: "key", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},
			{Name: "version", Type: migrator.DB_NVarchar, Length: 128, Nullable: false},

			// Raw bytes
			{Name: "body", Type: migrator.DB_Blob, Nullable: false},
			{Name: "size", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "etag", Type: migrator.DB_NVarchar, Length: 32, Nullable: false}, // md5(body)

			// Who changed what when
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated_by", Type: migrator.DB_Int, Nullable: false},

			// Commit message
			{Name: "message", Type: migrator.DB_Text, Nullable: false}, // defaults to empty string
		},
		Indices: []*migrator.Index{
			{Cols: []string{"key", "version"}, Type: migrator.UniqueIndex},
		},
	}

	// Define access based on prefix rules (eg... .htaccess (- ‿◦ ))
	objectAccessTable := migrator.Table{
		Name: "object_access",
		Columns: []*migrator.Column{
			{Name: "prefix", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},
			{Name: "action", Type: migrator.DB_NVarchar, Length: 255, Nullable: false}, // read, write, admin, none
			{Name: "kind", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "who", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"prefix"}, Type: migrator.IndexType},
			{Cols: []string{"prefix", "action", "kind", "who"}, Type: migrator.UniqueIndex},
		},
	}

	// Keep track of renames (404 handler)
	objectAliasTable := migrator.Table{
		Name: "object_alias",
		Columns: []*migrator.Column{
			{Name: "old_key", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false, IsPrimaryKey: true},
			{Name: "new_key", Type: migrator.DB_NVarchar, Length: 1024, Nullable: false},
			{Name: "updated", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "updated_by", Type: migrator.DB_Int, Nullable: false},
		},
		PrimaryKeys: []string{"old_key"},
		Indices: []*migrator.Index{
			{Cols: []string{"new_key"}, Type: migrator.IndexType},
		},
	}

	// Initialize all tables
	tables := []migrator.Table{objectTable, objectLabelsTable, objectReferenceTable, objectHistoryTable, objectAliasTable, objectAccessTable}
	for t := range tables {
		mg.AddMigration("ObjectStore init: table "+tables[t].Name, migrator.NewAddTableMigration(tables[t]))
		for i := range tables[t].Indices {
			mg.AddMigration(fmt.Sprintf("ObjectStore init: index %s[%d]", tables[t].Name, i), migrator.NewAddIndexMigration(tables[t], tables[t].Indices[i]))
		}
	}

	// TODO: add collation support to `migrator.Column`
	mg.AddMigration("ObjectStore init: set path collation in object tables", migrator.NewRawSQLMigration("").
		// MySQL `utf8mb4_unicode_ci` collation is set in `mysql_dialect.go`
		// SQLite uses a `BINARY` collation by default
		Postgres("ALTER TABLE object ALTER COLUMN path TYPE VARCHAR(1024) COLLATE \"C\";")) // Collate C - sorting done based on character code byte values
}

package migrations

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func initEntityTables(mg *migrator.Migrator) string {
	marker := "Initialize entity tables (v15)" // changing this key wipe+rewrite everything
	mg.AddMigration(marker, &migrator.RawSQLMigration{})

	tables := []migrator.Table{}
	tables = append(tables, migrator.Table{
		Name: "entity",
		Columns: []*migrator.Column{
			// primary identifier
			{Name: "guid", Type: migrator.DB_NVarchar, Length: 36, Nullable: false, IsPrimaryKey: true},
			{Name: "resource_version", Type: migrator.DB_BigInt, Nullable: false},

			// The entity identifier (TODO: remove -- this is a duplicate)
			{Name: "key", Type: migrator.DB_Text, Nullable: false},

			// K8s Identity group+(version)+namespace+resource+name
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "group_version", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 63, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},

			{Name: "folder", Type: migrator.DB_NVarchar, Length: 190, Nullable: false}, // uid of folder

			// The raw entity body (any byte array)
			{Name: "meta", Type: migrator.DB_Text, Nullable: true},     // raw meta object from k8s (with standard stuff removed)
			{Name: "body", Type: migrator.DB_LongText, Nullable: true}, // null when nested or remote
			{Name: "status", Type: migrator.DB_Text, Nullable: true},   // raw status object

			{Name: "size", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "etag", Type: migrator.DB_NVarchar, Length: 32, Nullable: false, IsLatin: true}, // md5(body)

			// Who changed what when
			{Name: "created_at", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "created_by", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "updated_at", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "updated_by", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},

			// Mark objects with origin metadata
			{Name: "origin", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "origin_key", Type: migrator.DB_Text, Nullable: false},
			{Name: "origin_ts", Type: migrator.DB_BigInt, Nullable: false},

			// Metadata
			{Name: "title", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "slug", Type: migrator.DB_NVarchar, Length: 190, Nullable: false}, // from title
			{Name: "description", Type: migrator.DB_Text, Nullable: true},

			// Commit message
			{Name: "message", Type: migrator.DB_Text, Nullable: false}, // defaults to empty string
			{Name: "labels", Type: migrator.DB_Text, Nullable: true},   // JSON object
			{Name: "fields", Type: migrator.DB_Text, Nullable: true},   // JSON object
			{Name: "errors", Type: migrator.DB_Text, Nullable: true},   // JSON object

			{Name: "action", Type: migrator.DB_Int, Nullable: false}, // 1: create, 2: update, 3: delete
		},
		Indices: []*migrator.Index{
			// The keys are ordered for efficiency in mysql queries, not URL consistency
			{Cols: []string{"namespace", "group", "resource", "name"}, Type: migrator.UniqueIndex}, // == key
			{Cols: []string{"folder"}, Type: migrator.IndexType},
		},
	})

	tables = append(tables, migrator.Table{
		Name: "entity_history",
		Columns: []*migrator.Column{
			// only difference from entity table is that we store multiple versions of the same entity
			// so we have a unique index on guid+version instead of guid as primary key
			{Name: "guid", Type: migrator.DB_NVarchar, Length: 36, Nullable: false},
			{Name: "resource_version", Type: migrator.DB_BigInt, Nullable: false},

			// The entity identifier (TODO: remove -- this is a duplicate)
			{Name: "key", Type: migrator.DB_Text, Nullable: false},

			// K8s Identity group+(version)+namespace+resource+name
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "group_version", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 63, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},

			{Name: "folder", Type: migrator.DB_NVarchar, Length: 190, Nullable: false}, // uid of folder
			{Name: "access", Type: migrator.DB_Text, Nullable: true},                   // JSON object

			// The raw entity body (any byte array)
			{Name: "meta", Type: migrator.DB_Text, Nullable: true},     // raw meta object from k8s (with standard stuff removed)
			{Name: "body", Type: migrator.DB_LongText, Nullable: true}, // null when nested or remote
			{Name: "status", Type: migrator.DB_Text, Nullable: true},   // raw status object

			{Name: "size", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "etag", Type: migrator.DB_NVarchar, Length: 32, Nullable: false, IsLatin: true}, // md5(body)

			// Who changed what when
			{Name: "created_at", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "created_by", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "updated_at", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "updated_by", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},

			// Mark objects with origin metadata
			{Name: "origin", Type: migrator.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "origin_key", Type: migrator.DB_Text, Nullable: false},
			{Name: "origin_ts", Type: migrator.DB_BigInt, Nullable: false},

			// Metadata
			{Name: "title", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "slug", Type: migrator.DB_NVarchar, Length: 190, Nullable: false}, // from title
			{Name: "description", Type: migrator.DB_Text, Nullable: true},

			// Commit message
			{Name: "message", Type: migrator.DB_Text, Nullable: false}, // defaults to empty string
			{Name: "labels", Type: migrator.DB_Text, Nullable: true},   // JSON object
			{Name: "fields", Type: migrator.DB_Text, Nullable: true},   // JSON object
			{Name: "errors", Type: migrator.DB_Text, Nullable: true},   // JSON object

			{Name: "action", Type: migrator.DB_Int, Nullable: false}, // 1: create, 2: update, 3: delete
		},
		Indices: []*migrator.Index{
			{Cols: []string{"guid", "resource_version"}, Type: migrator.UniqueIndex},
			{
				Cols: []string{"namespace", "group", "resource", "name", "resource_version"},
				Type: migrator.UniqueIndex,
				Name: "UQE_entity_history_namespace_group_name_version",
			},
			// index to support watch poller
			{Cols: []string{"resource_version"}, Type: migrator.IndexType},
		},
	})

	// when saving a folder, keep a path version cached (all info is derived from entity table)
	tables = append(tables, migrator.Table{
		Name: "entity_folder",
		Columns: []*migrator.Column{
			{Name: "guid", Type: migrator.DB_NVarchar, Length: 36, Nullable: false, IsPrimaryKey: true},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 63, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "slug_path", Type: migrator.DB_Text, Nullable: false}, // /slug/slug/slug/
			{Name: "tree", Type: migrator.DB_Text, Nullable: false},      // JSON []{uid, title}
			{Name: "depth", Type: migrator.DB_Int, Nullable: false},      // starts at 1
			{Name: "lft", Type: migrator.DB_Int, Nullable: false},        // MPTT
			{Name: "rgt", Type: migrator.DB_Int, Nullable: false},        // MPTT
			{Name: "detached", Type: migrator.DB_Bool, Nullable: false},  // a parent folder was not found
		},
	})

	tables = append(tables, migrator.Table{
		Name: "entity_labels",
		Columns: []*migrator.Column{
			{Name: "guid", Type: migrator.DB_NVarchar, Length: 36, Nullable: false},
			{Name: "label", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "value", Type: migrator.DB_Text, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"guid", "label"}, Type: migrator.UniqueIndex},
		},
	})

	tables = append(tables, migrator.Table{
		Name: "entity_ref",
		Columns: []*migrator.Column{
			// Source:
			{Name: "guid", Type: migrator.DB_NVarchar, Length: 36, Nullable: false},

			// Address (defined in the body, not resolved, may be invalid and change)
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 63, Nullable: false},
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: true},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 190, Nullable: true},

			// Runtime calcs (will depend on the system state)
			{Name: "resolved_ok", Type: migrator.DB_Bool, Nullable: false},
			{Name: "resolved_to", Type: migrator.DB_NVarchar, Length: 36, Nullable: false},
			{Name: "resolved_warning", Type: migrator.DB_Text, Nullable: false},
			{Name: "resolved_time", Type: migrator.DB_DateTime, Nullable: false}, // resolution cache timestamp
		},
		Indices: []*migrator.Index{
			{Cols: []string{"guid"}, Type: migrator.IndexType},
			{Cols: []string{"namespace", "group", "resource", "name"}, Type: migrator.IndexType},
			{Cols: []string{"resolved_to"}, Type: migrator.IndexType},
		},
	})

	// Initialize all tables
	for t := range tables {
		mg.AddMigration("drop table "+tables[t].Name, migrator.NewDropTableMigration(tables[t].Name))
		mg.AddMigration("create table "+tables[t].Name, migrator.NewAddTableMigration(tables[t]))
		for i := range tables[t].Indices {
			mg.AddMigration(fmt.Sprintf("create table %s, index: %d", tables[t].Name, i), migrator.NewAddIndexMigration(tables[t], tables[t].Indices[i]))
		}
	}

	return marker
}

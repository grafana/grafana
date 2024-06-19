package sqlnext

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func InitResourceTables(mg *migrator.Migrator) string {
	marker := "Initialize resource tables (vX)" // changing this key wipe+rewrite everything
	mg.AddMigration(marker, &migrator.RawSQLMigration{})

	tables := []migrator.Table{}

	// This table helps support incrementing the resource version within a group+resource
	tables = append(tables, migrator.Table{
		Name: "resource_version",
		Columns: []*migrator.Column{
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "rv", Type: migrator.DB_BigInt, Nullable: false}, // resource version
		},
		Indices: []*migrator.Index{
			{Cols: []string{"group", "resource"}, Type: migrator.UniqueIndex},
		},
	})

	tables = append(tables, migrator.Table{
		Name: "resource", // write only log?  all events
		Columns: []*migrator.Column{
			// SnowflakeID -- Each Create/Update/Delete call is an event
			// Using snowflake ID doubles this field as an approximate timestamp
			{Name: "event", Type: migrator.DB_BigInt, Nullable: false, IsPrimaryKey: true},

			// This will be null on insert, and then updated once we are ready to commit the transaction
			{Name: "rv", Type: migrator.DB_BigInt, Nullable: true},
			{Name: "previous_rv", Type: migrator.DB_BigInt, Nullable: true}, // needed?

			// Allows fast search for the first page in any query.
			// Subsequent pages must use MAX(rv) AND is_compacted=false GROUP ...
			{Name: "is_current", Type: migrator.DB_Bool, Nullable: false},

			// Indicates that this is no longer the current version
			// This value is updated every few minutes and makes the paged queries more efficient
			{Name: "is_compacted", Type: migrator.DB_Bool, Nullable: false},

			// Properties that exist in path/key (and duplicated in the json value)
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "api_version", Type: migrator.DB_NVarchar, Length: 32, Nullable: false},
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 63, Nullable: true}, // namespace is not required (cluster scope)
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},

			// The operation that wrote this resource version
			// 1: created, 2: updated, 3: deleted
			{Name: "operation", Type: migrator.DB_Int, Nullable: false},

			// Optional Commit message (currently only used for dashboards)
			{Name: "message", Type: migrator.DB_Text, Nullable: false}, // defaults to empty string

			// The k8s resource JSON text (without the resourceVersion populated)
			{Name: "value", Type: migrator.DB_MediumText, Nullable: false},

			// Content hash -- this is appropriate to use for an etag value
			{Name: "hash", Type: migrator.DB_NVarchar, Length: 32, Nullable: false},

			// Path to linked blob (or null).  This blob may be saved in SQL, or in an object store
			{Name: "blob_uid", Type: migrator.DB_NVarchar, Length: 60, Nullable: true},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"rv"}, Type: migrator.UniqueIndex},
			{Cols: []string{"is_current"}, Type: migrator.IndexType},
			{Cols: []string{"is_compacted"}, Type: migrator.IndexType},
			{Cols: []string{"operation"}, Type: migrator.IndexType},
			{Cols: []string{"namespace"}, Type: migrator.IndexType},
			{Cols: []string{"group", "resource", "name"}, Type: migrator.IndexType},
			{Cols: []string{"blob_uid"}, Type: migrator.IndexType},
		},
	})

	// The values in this table are created by parsing the the value JSON and writing these as searchable columns
	// These *could* be in the same table, but this structure allows us to replace the table by first
	// building a parallel structure, then swapping them... maybe :)
	tables = append(tables, migrator.Table{
		Name: "resource_meta", // write only log?  all events
		Columns: []*migrator.Column{
			{Name: "event", Type: migrator.DB_BigInt, Nullable: false, IsPrimaryKey: true},

			// Hashed label set
			{Name: "label_set", Type: migrator.DB_NVarchar, Length: 64, Nullable: true}, // null is no labels

			// Helpful filters
			{Name: "folder", Type: migrator.DB_NVarchar, Length: 190, Nullable: true}, // uid of folder

			// For sorting values come from metadata.annotations#grafana.app/*
			{Name: "created_at", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "updated_at", Type: migrator.DB_BigInt, Nullable: false},

			// Origin metadata helps implement efficient provisioning checks
			{Name: "origin", Type: migrator.DB_NVarchar, Length: 64, Nullable: true},       // The origin name
			{Name: "origin_path", Type: migrator.DB_Text, Nullable: true},                  // Path to resource
			{Name: "origin_hash", Type: migrator.DB_NVarchar, Length: 128, Nullable: true}, // Origin hash
			{Name: "origin_ts", Type: migrator.DB_BigInt, Nullable: true},                  // Origin timestamp
		},
		Indices: []*migrator.Index{
			{Cols: []string{"event"}, Type: migrator.IndexType},
			{Cols: []string{"folder"}, Type: migrator.IndexType},
			{Cols: []string{"created_at"}, Type: migrator.IndexType},
			{Cols: []string{"updated_at"}, Type: migrator.IndexType},
			{Cols: []string{"origin"}, Type: migrator.IndexType},
		},
	})

	// This table is optional, blobs can also be saved to object store or disk
	// This is an append only store
	tables = append(tables, migrator.Table{
		Name: "resource_blob", // even things that failed?
		Columns: []*migrator.Column{
			{Name: "uid", Type: migrator.DB_NVarchar, Length: 60, Nullable: false, IsPrimaryKey: true},
			{Name: "value", Type: migrator.DB_Blob, Nullable: true},
			{Name: "etag", Type: migrator.DB_NVarchar, Length: 64, Nullable: false},
			{Name: "size", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "content_type", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},

			// These is used for auditing and cleanup (could be path?)
			{Name: "namespace", Type: migrator.DB_NVarchar, Length: 63, Nullable: true},
			{Name: "group", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "resource", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"uid"}, Type: migrator.UniqueIndex},

			// Used for auditing
			{Cols: []string{"namespace", "group", "resource", "name"}, Type: migrator.IndexType},
		},
	})

	tables = append(tables, migrator.Table{
		Name: "resource_label_set",
		Columns: []*migrator.Column{
			{Name: "label_set", Type: migrator.DB_NVarchar, Length: 64, Nullable: false},
			{Name: "label", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "value", Type: migrator.DB_Text, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"label_set", "label"}, Type: migrator.UniqueIndex},
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

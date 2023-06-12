package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addPlaylistMigrations(mg *Migrator) {
	mg.AddMigration("Drop old table playlist table", NewDropTableMigration("playlist"))
	mg.AddMigration("Drop old table playlist_item table", NewDropTableMigration("playlist_item"))

	// create table
	mg.AddMigration("create playlist table v2", NewAddTableMigration(playlistV2()))

	playlistItemV2 := Table{
		Name: "playlist_item",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "playlist_id", Type: DB_BigInt, Nullable: false},
			{Name: "type", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "value", Type: DB_Text, Nullable: false},
			{Name: "title", Type: DB_Text, Nullable: false},
			{Name: "order", Type: DB_Int, Nullable: false},
		},
	}

	mg.AddMigration("create playlist item table v2", NewAddTableMigration(playlistItemV2))

	mg.AddMigration("Update playlist table charset", NewTableCharsetMigration("playlist", []*Column{
		{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
		{Name: "interval", Type: DB_NVarchar, Length: 255, Nullable: false},
	}))

	mg.AddMigration("Update playlist_item table charset", NewTableCharsetMigration("playlist_item", []*Column{
		{Name: "type", Type: DB_NVarchar, Length: 255, Nullable: false},
		{Name: "value", Type: DB_Text, Nullable: false},
		{Name: "title", Type: DB_Text, Nullable: false},
	}))
}

func addPlaylistUIDMigration(mg *Migrator) {
	// Replacing auto-incremented playlistIDs with string UIDs
	mg.AddMigration("Add UID column to playlist", NewAddColumnMigration(playlistV2(), &Column{
		Name: "uid", Type: DB_NVarchar, Length: 80, Nullable: false, Default: "0",
	}))

	// copy the (string representation of) existing IDs into the new uid column.
	mg.AddMigration("Update uid column values in playlist", NewRawSQLMigration("").
		SQLite("UPDATE playlist SET uid=printf('%d',id);").
		Postgres("UPDATE playlist SET uid=id::text;").
		Mysql("UPDATE playlist SET uid=id;"))

	mg.AddMigration("Add index for uid in playlist", NewAddIndexMigration(playlistV2(), &Index{
		Cols: []string{"org_id", "uid"}, Type: UniqueIndex,
	}))
}

func playlistV2() Table {
	return Table{
		Name: "playlist",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "interval", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
		},
	}
}

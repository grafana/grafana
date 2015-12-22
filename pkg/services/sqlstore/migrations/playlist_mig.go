package migrations

import . "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

func addPlaylistMigrations(mg *Migrator) {
	playlistV1 := Table{
		Name: "playlist",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "title", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "type", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "data", Type: DB_Text, Nullable: false},
			{Name: "timespan", Type: DB_NVarchar, Length: 255, Nullable: false},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
		},
	}

	// create table
	mg.AddMigration("create playlist table v1", NewAddTableMigration(playlistV1))
}

package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// addNatsDiscoveryMigrations creates the KV table backing the nats/peers section
// used by embedded NATS peer discovery. This lives in the core migrator (not the
// unified resource-store migrator) because the discovery KV is built directly on
// the core Grafana sqlStore in nats.ProvideServer. The resource-store migrator is
// skipped entirely for the file/unified-grpc/unified-kv-grpc storage types, so
// placing it there would leave embedded NATS without a table in those setups.
func addNatsDiscoveryMigrations(mg *Migrator) {
	natsDiscoveryPeers := Table{
		Name: "nats_discovery_peers",
		Columns: []*Column{
			{Name: "key_path", Type: DB_NVarchar, Length: 2048, Nullable: false, IsPrimaryKey: true, IsLatin: true},
			{Name: "value", Type: DB_Text, Nullable: false},
		},
	}

	mg.AddMigration("create table nats_discovery_peers", NewAddTableMigration(natsDiscoveryPeers))
	mg.AddMigration("Change key_path collation of nats_discovery_peers in postgres", NewRawSQLMigration("").
		Postgres(`ALTER TABLE nats_discovery_peers ALTER COLUMN key_path TYPE VARCHAR(2048) COLLATE "C";`))
}

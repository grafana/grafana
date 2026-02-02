/*
 * Copyright (C) 2023-2025 BMC Helix Inc
 * Added by mahmedi at 18/11/2024
 */

package bhd_localization

import (
	mig "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func AddMigration(mg *mig.Migrator) {
	// columns required
	// id, uid, org_id, resource_uid, en_US, fr_FR, es_ES, fr_CA, de_DE, en_FR, it_IT
	// {name: '', description: ''}
	localizationTableV1 := mig.Table{
		Name: "bhd_localization",
		Columns: []*mig.Column{
			{Name: "id", Type: mig.DB_BigInt, IsPrimaryKey: true, Nullable: false, IsAutoIncrement: true},
			{Name: "uid", Type: mig.DB_NVarchar, Length: 40, Nullable: false},
			{Name: "org_id", Type: mig.DB_BigInt, Nullable: false},
			{Name: "resource_uid", Type: mig.DB_NVarchar, Nullable: false},
			{Name: "en-US", Type: mig.DB_Text, Nullable: false, Default: "'{}'"},
			{Name: "fr-FR", Type: mig.DB_Text, Nullable: false, Default: "'{}'"},
			{Name: "es-ES", Type: mig.DB_Text, Nullable: false, Default: "'{}'"},
			{Name: "de-DE", Type: mig.DB_Text, Nullable: false, Default: "'{}'"},
			{Name: "fr-CA", Type: mig.DB_Text, Nullable: false, Default: "'{}'"},
			{Name: "en-CA", Type: mig.DB_Text, Nullable: false, Default: "'{}'"},
		},
		Indices: []*mig.Index{
			{
				Name: "bhd_uid_org_id_ukey",
				Type: mig.UniqueIndex,
				Cols: []string{"uid", "org_id"},
			},
		},
	}
	mg.AddMigration("bhd: create bhd_localization table v1", mig.NewAddTableMigration(localizationTableV1))
	mg.AddMigration("bhd: alter table create index bhd_uid_org_id_ukey", mig.NewAddIndexMigration(localizationTableV1, localizationTableV1.Indices[0]))
	mg.AddMigration("bhd: add column it_IT in bhd_localization table", mig.NewAddColumnMigration(localizationTableV1, &mig.Column{
		Name: "it-IT", Type: mig.DB_Text, Nullable: false, Default: "'{}'",
	}))
	mg.AddMigration("bhd: add column ar_AR in bhd_localization table", mig.NewAddColumnMigration(localizationTableV1, &mig.Column{
		Name: "ar-AR", Type: mig.DB_Text, Nullable: false, Default: "'{}'",
	}))
}

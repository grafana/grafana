/*
 * Copyright (C) 2021-2025 BMC Helix Inc
 * Added by kmejdi at 29/7/2021
 */

package migrations

import (
	"fmt"

	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const (
	defaultOrg           = 1
	defaultDocLink       = "https://docs.bmc.com/xwiki/bin/view/Helix-Common-Services/Dashboards-Reports/BMC-Helix-Dashboards/BHD261"
	defaultSupportLink   = "https://www.bmc.com/support"
	defaultCommunityLink = "https://communities.bmc.com"
	defaultVideoLink     = "https://www.youtube.com/watch?v=KvL1x6ZSNsc"
)

func addCustomConfigurationMigrations(mg *Migrator) {
	configTableV1 := Table{
		Name: "configuration",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: DB_BigInt, Nullable: false},
			{Name: "doc_link", Type: DB_Text, Nullable: true},
			{Name: "support_link", Type: DB_Text, Nullable: true},
			{Name: "community_link", Type: DB_Text, Nullable: true},
			{Name: "video_link", Type: DB_Text, Nullable: true},
		},
		Indices: []*Index{},
	}
	mg.AddMigration("create configuration table v1", NewAddTableMigration(configTableV1))

	// Create default configuration for Main Org.
	mg.AddMigration("create default configuration for main org",
		NewRawSQLMigration(fmt.Sprintf(`
			INSERT INTO configuration (org_id, doc_link, support_link, community_link, video_link)
			VALUES(1, '%s','%s', '%s','%s')`,
			defaultDocLink, defaultSupportLink, defaultCommunityLink, defaultVideoLink)),
	)

	mg.AddMigration("Updating configuration for documentation link, 22.2.0 release",
		NewRawSQLMigration(fmt.Sprintf(`
			UPDATE configuration SET doc_link='%s' where org_id=1`, defaultDocLink)),
	)

	mg.AddMigration("Updating configuration for documentation link, 22.3.0 release",
		NewRawSQLMigration(fmt.Sprintf(`
			UPDATE configuration SET doc_link='%s' where org_id=1`, defaultDocLink)),
	)

	mg.AddMigration("Updating configuration for documentation link, 22.4.0 release",
		NewRawSQLMigration(fmt.Sprintf(`
			UPDATE configuration SET doc_link='%s' where org_id=1`, defaultDocLink)),
	)

	mg.AddMigration("Updating configuration for documentation link, 23.1.0 release",
		NewRawSQLMigration(fmt.Sprintf(`
			UPDATE configuration SET doc_link='%s' where org_id=1`, defaultDocLink)),
	)

	mg.AddMigration("Updating configuration for documentation link, 23.2.0 release",
		NewRawSQLMigration(fmt.Sprintf(`
			UPDATE configuration SET doc_link='%s' where org_id=1`, defaultDocLink)),
	)

	mg.AddMigration("Updating configuration for documentation link, 23.3.0 release",
		NewRawSQLMigration(fmt.Sprintf(`
			UPDATE configuration SET doc_link='%s' where org_id=1`, defaultDocLink)),
	)

	mg.AddMigration("Adding query type column in configuration, 23.4.0 release",
		NewRawSQLMigration("Alter table configuration add query_type varchar"),
	)

	mg.AddMigration("Updating configuration for documentation link, 23.4.0 release",
		NewRawSQLMigration(fmt.Sprintf(`
			UPDATE configuration SET doc_link='%s' where org_id=1`, defaultDocLink)),
	)

	mg.AddMigration("Updating configuration for documentation link, 24.1.00 release",
		NewRawSQLMigration(fmt.Sprintf(`
			UPDATE configuration SET doc_link='%s' where org_id=1`, defaultDocLink)),
	)

	mg.AddMigration("Updating configuration for documentation link, 24.2.00 release",
		NewRawSQLMigration(fmt.Sprintf(`
			UPDATE configuration SET doc_link='%s' where org_id=1`, defaultDocLink)),
	)

	mg.AddMigration("Updating configuration for documentation link, 24.3.00 release",
		NewRawSQLMigration(fmt.Sprintf(`
			UPDATE configuration SET doc_link='%s' where org_id=1`, defaultDocLink)),
	)

	mg.AddMigration("Updating configuration for documentation link, 24.4.00 release",
		NewRawSQLMigration(fmt.Sprintf(`
			UPDATE configuration SET doc_link='%s' where org_id=1`, defaultDocLink)),
	)

	mg.AddMigration("Updating configuration for documentation link, 25.1.00 release",
		NewRawSQLMigration(fmt.Sprintf(`
			UPDATE configuration SET doc_link='%s' where org_id=1`, defaultDocLink)),
	)

	mg.AddMigration("Updating configuration for documentation link, 25.2.00 release",
		NewRawSQLMigration(fmt.Sprintf(`
			UPDATE configuration SET doc_link='%s' where org_id=1`, defaultDocLink)),
	)

	mg.AddMigration("Updating configuration for documentation link, 25.3.00 release",
		NewRawSQLMigration(fmt.Sprintf(`
			UPDATE configuration SET doc_link='%s' where org_id=1`, defaultDocLink)),
	)

	mg.AddMigration("Updating configuration for documentation link, 25.4.00 release",
		NewRawSQLMigration(fmt.Sprintf(`
			UPDATE configuration SET doc_link='%s' where org_id=1`, defaultDocLink)),
	)

	mg.AddMigration("Updating configuration for documentation link, 26.1.00 release",
		NewRawSQLMigration(fmt.Sprintf(`
			UPDATE configuration SET doc_link='%s' where org_id=1`, defaultDocLink)),
	)
}

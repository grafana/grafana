/*
 * Copyright (C) 2025 BMC Helix Inc
 */

package migrations

import (
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// DRJ71-17052 - vishaln
// Table to store the list of views chosen by the user in Insight finder, can be considered as "enabled" for Insight Finder.

func addMetadataInsightFinder(mg *Migrator) {
	metadataInsightFinderViews := Table{
		Name: "rms_insight_finder",
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "tenant_id", Type: DB_BigInt, Nullable: false},
			{Name: "selected_views", Type: DB_Text, Nullable: true, Default: ""},
			{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			{Cols: []string{"name", "tenant_id"}, Type: UniqueIndex},
		},
	}

	// Create new view list table if not created already through grafana migration utility
	mg.AddMigration("create RMS metadata insight finder enabled views table v1", NewAddTableMigration(metadataInsightFinderViews))
}

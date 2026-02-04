package search

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

// StandardDocumentBuilders provides the default list of document builders for open source Grafana.
// It combines the standard document builder with external builders for dashboards and users.
type StandardDocumentBuilders struct {
	sql                   db.DB
	sprinkles             builders.DashboardStats
	teamMemberCountLookup builders.TeamMemberCountLookup
}

func ProvideDocumentBuilders(sql db.DB, sprinkles builders.DashboardStats) resource.DocumentBuilderSupplier {
	return &StandardDocumentBuilders{sql: sql, sprinkles: sprinkles}
}

func (s *StandardDocumentBuilders) SetTeamMemberCountLookup(lookup builders.TeamMemberCountLookup) {
	s.teamMemberCountLookup = lookup
}

func (s *StandardDocumentBuilders) GetDocumentBuilders() ([]resource.DocumentBuilderInfo, error) {
	all, err := builders.All(s.sql, s.sprinkles, s.teamMemberCountLookup)
	if err != nil {
		return nil, err
	}

	result := []resource.DocumentBuilderInfo{
		{
			Builder: resource.StandardDocumentBuilder(resource.AppManifests()),
		},
	}
	return append(result, all...), nil
}

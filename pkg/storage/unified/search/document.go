package search

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

// StandardDocumentBuilders provides the default list of document builders for open source Grafana.
// It combines the standard document builder with external builders for dashboards and users.
type StandardDocumentBuilders struct {
	sql       db.DB
	sprinkles builders.DashboardStats
}

func ProvideDocumentBuilders(sql db.DB, sprinkles builders.DashboardStats) resource.DocumentBuilderSupplier {
	return &StandardDocumentBuilders{sql, sprinkles}
}

func (s *StandardDocumentBuilders) GetDocumentBuilders() ([]resource.DocumentBuilderInfo, error) {
	all, err := builders.All(s.sql, s.sprinkles)
	if err != nil {
		return nil, err
	}

	result := []resource.DocumentBuilderInfo{
		{
			Builder: resource.StandardDocumentBuilder(),
		},
	}
	return append(result, all...), nil
}

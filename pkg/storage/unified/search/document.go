package search

import (
	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

// StandardDocumentBuilders provides the default list of document builders for open source Grafana.
// It combines the standard document builder with external builders for dashboards and users.
type StandardDocumentBuilders struct {
	sql       db.DB
	sprinkles builders.DashboardStats
}

func ProvideDocumentBuilders(sql db.DB, sprinkles builders.DashboardStats) searchmodel.DocumentBuilderSupplier {
	return &StandardDocumentBuilders{sql, sprinkles}
}

func (s *StandardDocumentBuilders) GetDocumentBuilders(registry *searchmodel.SearchFieldsRegistry) ([]searchmodel.DocumentBuilderInfo, error) {
	all, err := builders.All(registry, s.sql, s.sprinkles)
	if err != nil {
		return nil, err
	}

	result := []searchmodel.DocumentBuilderInfo{ //nolint:prealloc
		{
			Builder: searchmodel.StandardDocumentBuilder(registry),
		},
	}
	return append(result, all...), nil
}

package search

import (
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

type sqlSessionProvider interface {
	GetSqlxSession() *session.SessionDB
}

// StandardDocumentBuilders provides the default list of document builders for open source Grafana.
// It combines the standard document builder with external builders for dashboards and users.
type StandardDocumentBuilders struct {
	sql       sqlSessionProvider
	sprinkles builders.DashboardStats
}

func ProvideDocumentBuilders(sql sqlSessionProvider, sprinkles builders.DashboardStats) resource.DocumentBuilderSupplier {
	return &StandardDocumentBuilders{sql, sprinkles}
}

func (s *StandardDocumentBuilders) GetDocumentBuilders() ([]resource.DocumentBuilderInfo, error) {
	all, err := builders.All(s.sql, s.sprinkles)
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

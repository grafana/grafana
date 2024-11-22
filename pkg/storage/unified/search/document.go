package search

import (
	"context"

	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// The default list of open source document builders
type StandardDocumentBuilders struct{}

// Hooked up so wire can fill in different sprinkles
func ProvideDocumentBuilders() resource.DocumentBuilderSupplier {
	return &StandardDocumentBuilders{}
}

func (s *StandardDocumentBuilders) GetDocumentBuilders() ([]resource.DocumentBuilderInfo, error) {
	dashboards, err := DashboardBuilder(func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
		return &DashboardDocumentBuilder{
			Namespace:        namespace,
			Blob:             blob,
			Stats:            NewDashboardStatsLookup(nil), // empty stats
			DatasourceLookup: dashboard.CreateDatasourceLookup([]*dashboard.DatasourceQueryResult{{}}),
		}, nil
	})

	return []resource.DocumentBuilderInfo{
		// The default builder
		resource.DocumentBuilderInfo{
			Builder: resource.StandardDocumentBuilder(),
		},
		// Dashboard builder
		dashboards,
	}, err
}

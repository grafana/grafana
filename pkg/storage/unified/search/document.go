package search

import (
	"context"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// The default list of open source document builders
type StandardDocumentBuilders struct {
	sql db.DB
}

// Hooked up so wire can fill in different sprinkles
func ProvideDocumentBuilders(sql db.DB) resource.DocumentBuilderSupplier {
	return &StandardDocumentBuilders{sql}
}

func (s *StandardDocumentBuilders) GetDocumentBuilders() ([]resource.DocumentBuilderInfo, error) {
	dashboards, err := DashboardBuilder(func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
		stats := NewDashboardStatsLookup(nil) // empty stats
		dsinfo := []*dashboard.DatasourceQueryResult{{}}
		ns, err := claims.ParseNamespace(namespace)
		if err != nil && s.sql != nil {
			rows, err := s.sql.GetSqlxSession().Query(ctx, "SELECT uid,type,name,is_default FROM data_source WHERE org_id=?", ns.OrgID)
			if err != nil {
				return nil, err
			}
			for rows.Next() {
				info := &dashboard.DatasourceQueryResult{}
				err = rows.Scan(&info.UID, &info.Type, &info.Name, &info.IsDefault)
				if err != nil {
					return nil, err
				}
				dsinfo = append(dsinfo, info)
			}
		}
		return &DashboardDocumentBuilder{
			Namespace:        namespace,
			Blob:             blob,
			Stats:            stats,
			DatasourceLookup: dashboard.CreateDatasourceLookup(dsinfo),
		}, nil
	})

	return []resource.DocumentBuilderInfo{
		// The default builder
		{
			Builder: resource.StandardDocumentBuilder(),
		},
		// Dashboard builder
		dashboards,
	}, err
}

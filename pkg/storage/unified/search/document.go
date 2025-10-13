package search

import (
	"context"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// The default list of open source document builders
type StandardDocumentBuilders struct {
	sql       db.DB
	sprinkles DashboardStats
}

// Hooked up so wire can fill in different sprinkles
func ProvideDocumentBuilders(sql db.DB, sprinkles DashboardStats) resource.DocumentBuilderSupplier {
	return &StandardDocumentBuilders{sql, sprinkles}
}

func (s *StandardDocumentBuilders) GetDocumentBuilders() ([]resource.DocumentBuilderInfo, error) {
	dashboards, err := DashboardBuilder(func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
		logger := log.New("dashboard_builder", "namespace", namespace)
		dsinfo := []*dashboard.DatasourceQueryResult{{}}
		ns, err := claims.ParseNamespace(namespace)
		if err != nil && s.sql != nil {
			rows, err := s.sql.GetSqlxSession().Query(ctx, "SELECT uid,type,name,is_default FROM data_source WHERE org_id=?", ns.OrgID)
			if err != nil {
				return nil, err
			}

			defer func() {
				_ = rows.Close()
			}()

			for rows.Next() {
				info := &dashboard.DatasourceQueryResult{}
				err = rows.Scan(&info.UID, &info.Type, &info.Name, &info.IsDefault)
				if err != nil {
					return nil, err
				}
				dsinfo = append(dsinfo, info)
			}
		}

		// Fetch dashboard sprinkles for the namespace
		// This could take a while if namespace has a lot of dashboards
		var stats map[string]map[string]int64
		if s.sprinkles != nil {
			stats, err = s.sprinkles.GetStats(ctx, namespace)
			if err != nil {
				// only log a warning. Don't need to fail the indexer if we can't get sprinkles
				logger.Warn("Failed to get sprinkles", "error", err)
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

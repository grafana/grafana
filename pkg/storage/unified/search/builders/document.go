package builders

import (
	"context"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// All returns all document builders from this package.
// These builders have dependencies on Grafana apps (dashboard and user).
func All(sql db.DB, sprinkles DashboardStats) ([]resource.DocumentBuilderInfo, error) {
	dashboards, err := DashboardBuilder(func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
		logger := log.New("dashboard_builder", "namespace", namespace)
		dsinfo := []*dashboard.DatasourceQueryResult{{}}
		ns, err := claims.ParseNamespace(namespace)
		if err != nil && sql != nil {
			rows, err := sql.GetSqlxSession().Query(ctx, "SELECT uid,type,name,is_default FROM data_source WHERE org_id=?", ns.OrgID)
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

		var stats map[string]map[string]int64
		if sprinkles != nil {
			stats, err = sprinkles.GetStats(ctx, namespace)
			if err != nil {
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

	if err != nil {
		return nil, err
	}

	users, err := GetUserBuilder()
	if err != nil {
		return nil, err
	}

	extGroupMappings, err := GetExternalGroupMappingBuilder()
	if err != nil {
		return nil, err
	}

	teams, err := GetTeamSearchBuilder()
	if err != nil {
		return nil, err
	}

	return []resource.DocumentBuilderInfo{dashboards, users, extGroupMappings, teams}, nil
}

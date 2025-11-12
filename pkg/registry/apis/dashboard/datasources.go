package dashboard

import (
	"context"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type datasourceInfoProvider struct {
	datasourceService datasources.DataSourceService
}

func (d *datasourceInfoProvider) GetDataSourceInfo(ctx context.Context) []schemaversion.DataSourceInfo {
	// Extract namespace info from context to get OrgID
	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		// If namespace info is not available, return empty list
		return []schemaversion.DataSourceInfo{}
	}

	// Use GetDataSources with OrgID query instead of GetAllDataSources
	// This ensures tenant-aware datasource retrieval
	query := datasources.GetDataSourcesQuery{
		OrgID: nsInfo.OrgID,
	}
	dataSources, err := d.datasourceService.GetDataSources(ctx, &query)

	if err != nil {
		return []schemaversion.DataSourceInfo{}
	}

	out := make([]schemaversion.DataSourceInfo, 0, len(dataSources))

	for _, ds := range dataSources {
		out = append(out, schemaversion.DataSourceInfo{
			Name:       ds.Name,
			UID:        ds.UID,
			ID:         ds.ID,
			Type:       ds.Type,
			Default:    ds.IsDefault,
			APIVersion: ds.APIVersion,
		})
	}

	return out
}

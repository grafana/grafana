package dashboard

import (
	"context"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type datasourceInfoProvider struct {
	datasourceService datasources.DataSourceService
}

func (d *datasourceInfoProvider) GetDataSourceInfo(_ context.Context) []schemaversion.DataSourceInfo {
	query := datasources.GetAllDataSourcesQuery{}
	dataSources, err := d.datasourceService.GetAllDataSources(context.Background(), &query)

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

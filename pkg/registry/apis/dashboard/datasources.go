package dashboard

import (
	"context"

	"github.com/grafana/grafana/pkg/apis/dashboard/migration/schemaversion"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
)

type datasourceInfoProvider struct {
	datasourceService datasources.DataSourceService
	cfg               *setting.Cfg
}

func (d *datasourceInfoProvider) GetDataSourceInfo() []schemaversion.DataSourceInfo {
	query := datasources.GetDataSourcesQuery{DataSourceLimit: d.cfg.DataSourceLimit}
	dataSources, err := d.datasourceService.GetDataSources(context.Background(), &query)
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

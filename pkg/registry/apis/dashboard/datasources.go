package dashboard

import (
	"context"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type datasourceIndexProvider struct {
	datasourceService datasources.DataSourceService
}

// Index builds a datasource index directly from the datasource service query.
// This is more efficient than GetDataSourceInfo + NewDatasourceIndex as it avoids
// creating an intermediate slice and iterates over the datasources only once.
func (d *datasourceIndexProvider) Index(ctx context.Context) *schemaversion.DatasourceIndex {
	// Extract namespace info from context to get OrgID
	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		// If namespace info is not available, return empty index
		return &schemaversion.DatasourceIndex{
			ByName: make(map[string]*schemaversion.DataSourceInfo),
			ByUID:  make(map[string]*schemaversion.DataSourceInfo),
		}
	}

	// Use GetDataSources with OrgID query
	query := datasources.GetDataSourcesQuery{
		OrgID: nsInfo.OrgID,
	}
	dataSources, err := d.datasourceService.GetDataSources(ctx, &query)

	if err != nil {
		return &schemaversion.DatasourceIndex{
			ByName: make(map[string]*schemaversion.DataSourceInfo),
			ByUID:  make(map[string]*schemaversion.DataSourceInfo),
		}
	}

	// Build index directly without intermediate slice allocation
	// Single iteration over datasources populates all maps
	index := &schemaversion.DatasourceIndex{
		ByName: make(map[string]*schemaversion.DataSourceInfo, len(dataSources)),
		ByUID:  make(map[string]*schemaversion.DataSourceInfo, len(dataSources)),
	}

	for _, ds := range dataSources {
		dsInfo := &schemaversion.DataSourceInfo{
			Name:       ds.Name,
			UID:        ds.UID,
			ID:         ds.ID,
			Type:       ds.Type,
			Default:    ds.IsDefault,
			APIVersion: ds.APIVersion,
		}

		// Index by name if present
		if ds.Name != "" {
			index.ByName[ds.Name] = dsInfo
		}

		// Index by UID if present
		if ds.UID != "" {
			index.ByUID[ds.UID] = dsInfo
		}

		// Track default datasource
		if ds.IsDefault {
			index.DefaultDS = dsInfo
		}
	}

	return index
}

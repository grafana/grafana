package dashboard

import (
	"context"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	datasourceext "github.com/grafana/grafana/pkg/extensions/datasource"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	k8sRequest "k8s.io/apiserver/pkg/endpoints/request"
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

type multiTenantDatasourceProvider struct {
	cloudConfigClient datasourceext.CloudConfigClient
	log               log.Logger
}

func (d *multiTenantDatasourceProvider) GetDataSourceInfo(ctx context.Context) []schemaversion.DataSourceInfo {
	if d.cloudConfigClient == nil {
		return []schemaversion.DataSourceInfo{}
	}

	// Get namespace from ctx
	namespace := k8sRequest.NamespaceValue(ctx)
	if namespace == "" {
		d.log.Error("No namespace in context")
		return []schemaversion.DataSourceInfo{}
	}

	dataSources, err := d.cloudConfigClient.ListDatasources(ctx, namespace)

	if err != nil {
		d.log.Error("Error getting datasources", "error", err)
		return []schemaversion.DataSourceInfo{}
	}

	out := make([]schemaversion.DataSourceInfo, 0, len(dataSources.Items))

	for _, ds := range dataSources.Items {
		out = append(out, schemaversion.DataSourceInfo{
			Name:       ds.Name,
			UID:        string(ds.UID),
			ID:         ds.Spec.ID,
			Type:       ds.Spec.Type,
			Default:    false,
			APIVersion: ds.APIVersion,
		})
	}

	return out
}

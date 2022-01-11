import { AppEvents, DataQuery, DataSourceApi, DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { isExpressionReference } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import appEvents from 'app/core/app_events';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { importDataSourcePlugin } from 'app/features/plugins/plugin_loader';

export async function updateQueries(
  newSettings: DataSourceInstanceSettings,
  queries: DataQuery[],
  dsSettings?: DataSourceInstanceSettings
): Promise<DataQuery[]> {
  const datasource = getDataSourceRef(newSettings);
  // we are changing data source type
  if (dsSettings?.type !== newSettings.type) {
    // If changing to mixed do nothing
    if (newSettings.meta.mixed) {
      return queries;
    } else {
      const dataSourceSrv = getDatasourceSrv();

      let datasource: DataSourceApi;

      try {
        datasource = await dataSourceSrv.get(newSettings.uid);
      } catch (error) {
        datasource = await dataSourceSrv.get();
      }
      const clearedQueries = [{ refId: 'A', datasource }];

      try {
        const dsPlugin = await importDataSourcePlugin(datasource.meta);
        if (dsPlugin.onDatasourceChange) {
          return (
            (await dsPlugin.onDatasourceChange(
              dsSettings!,
              newSettings,
              queries.map((q) => ({
                ...q,
                datasource,
              }))
            )) || clearedQueries
          );
        }
      } catch (err) {
        appEvents.emit(AppEvents.alertError, [datasource.name, ' plugin failed', err.toString()]);
      }

      // Changing to another datasource type clear queries if no change handler is provided
      return clearedQueries;
    }
  }

  // Set data source on all queries except expression queries
  return queries.map((query) => {
    if (!isExpressionReference(query.datasource)) {
      query.datasource = datasource;
    }
    return query;
  });
}

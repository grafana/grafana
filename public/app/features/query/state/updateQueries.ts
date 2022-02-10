import { DataQuery, DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { isExpressionReference } from '@grafana/runtime/src/utils/DataSourceWithBackend';

export function updateQueries(
  newSettings: DataSourceInstanceSettings,
  queries: DataQuery[],
  dsSettings?: DataSourceInstanceSettings
): DataQuery[] {
  const datasource = getDataSourceRef(newSettings);

  // we are changing data source type
  if (dsSettings?.type !== newSettings.type) {
    // If changing to mixed do nothing
    if (newSettings.meta.mixed) {
      return queries;
    } else {
      // Changing to another datasource type clear queries
      return [{ refId: 'A', datasource }];
    }
  }

  // Set data source on all queries except expression queries
  return queries.map((query) => {
    if (!isExpressionReference(query.datasource) && !newSettings.meta.mixed) {
      query.datasource = datasource;
    }
    return query;
  });
}

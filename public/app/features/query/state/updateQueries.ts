import {
  DataQuery,
  DataSourceInstanceSettings,
  getDataSourceRef,
  hasQueryExportSupport,
  hasQueryImportSupport,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { isExpressionReference } from '@grafana/runtime/src/utils/DataSourceWithBackend';

export async function updateQueries(
  newSettings: DataSourceInstanceSettings,
  queries: DataQuery[],
  dsSettings?: DataSourceInstanceSettings
): Promise<DataQuery[]> {
  let nextQueries = queries;
  const datasource = getDataSourceRef(newSettings);
  const nextDS = await getDataSourceSrv().get(newSettings.uid);
  let currentDS;

  if (dsSettings) {
    currentDS = await getDataSourceSrv().get(dsSettings.uid);
  }

  // we are changing data source type
  if (currentDS?.meta.id !== nextDS.meta.id) {
    // If changing to mixed do nothing
    if (nextDS.meta.mixed) {
      return queries;
    }
    // when both data sources support abstract queries
    else if (hasQueryExportSupport(currentDS) && hasQueryImportSupport(nextDS)) {
      const abstractQueries = await currentDS.exportToAbstractQueries(queries);
      nextQueries = await nextDS.importFromAbstractQueries(abstractQueries);
    }
    // when datasource supports query import
    else if (currentDS && nextDS.importQueries) {
      nextQueries = await nextDS.importQueries(queries, currentDS);
    }
    // Otherwise clear queries
    else {
      return [{ refId: 'A', datasource }];
    }
  }

  // Set data source on all queries except expression queries
  return nextQueries.map((query) => {
    if (!isExpressionReference(query.datasource) && !nextDS.meta.mixed) {
      query.datasource = datasource;
    }
    return query;
  });
}

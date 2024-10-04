import { DataQueryRequest } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import { config } from '../config';
import { getBackendSrv } from '../services';

export interface MigrationHandler {
  hasBackendMigration: boolean;
  shouldMigrate(query: DataQuery): boolean;
}

export function instanceOfMigrationHandler(object: any): object is MigrationHandler {
  return 'hasBackendMigration' in object && 'shouldMigrate' in object;
}

async function postMigrateRequest<TQuery extends DataQuery>(queries: TQuery[]): Promise<TQuery[]> {
  if (!(config.featureToggles.grafanaAPIServerWithExperimentalAPIs || config.featureToggles.datasourceAPIServers)) {
    console.warn('migrateQuery is only available with the experimental API server');
    return queries;
  }

  // Obtaining the GroupName from the plugin ID as done in the backend, this is temporary until we have a better way to obtain it
  // https://github.com/grafana/grafana/blob/e013cd427cb0457177e11f19ebd30bc523b36c76/pkg/plugins/apiserver.go#L10
  const dsnameURL = queries[0].datasource?.type?.replace(/^(grafana-)?(.*?)(-datasource)?$/, '$2');
  const groupName = `${dsnameURL}.datasource.grafana.app`;
  // Asuming apiVersion is v0alpha1, we'll need to obtain it from a trusted source
  const apiVersion = 'v0alpha1';
  const url = `/apis/${groupName}/${apiVersion}/namespaces/${config.namespace}/queryconvert`;
  const request = {
    queries: queries.map((query) => {
      return {
        ...query,
        JSON: query, // JSON is not part of the type but it should be what holds the query
      };
    }),
  };
  const res = await getBackendSrv().post(url, request);
  return res.queries.map((query: { JSON: TQuery }) => query.JSON);
}

/**
 * @alpha Experimental: Calls migration endpoint with one query. Requires grafanaAPIServerWithExperimentalAPIs or datasourceAPIServers feature toggle.
 */
export async function migrateQuery<TQuery extends DataQuery>(
  datasource: MigrationHandler,
  query: TQuery
): Promise<TQuery> {
  if (!datasource.hasBackendMigration || !datasource.shouldMigrate(query)) {
    return query;
  }
  const res = await postMigrateRequest([query]);
  return res[0];
}

/**
 * @alpha Experimental: Calls migration endpoint with multiple queries. Requires grafanaAPIServerWithExperimentalAPIs or datasourceAPIServers feature toggle.
 */
export async function migrateRequest<TQuery extends DataQuery>(
  datasource: MigrationHandler,
  request: DataQueryRequest<TQuery>
): Promise<DataQueryRequest<TQuery>> {
  const promises = request.targets.map((query) => {
    if (!datasource.hasBackendMigration || !datasource.shouldMigrate(query)) {
      return Promise.resolve(query);
    }
    return migrateQuery(datasource, query);
  });
  request.targets = await Promise.all(promises);
  return request;
}

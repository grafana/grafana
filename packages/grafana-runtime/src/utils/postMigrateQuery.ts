import { DataQuery } from '@grafana/schema';

import { config } from '../config';
import { getBackendSrv } from '../services';

/**
 * @alpha Experimental: Calls migration endpoint. Requires grafanaAPIServerWithExperimentalAPIs or datasourceAPIServers feature toggle.
 */
export function postMigrateQuery<TQuery extends DataQuery = DataQuery>(query: TQuery): Promise<TQuery> | TQuery {
  if (!(config.featureToggles.grafanaAPIServerWithExperimentalAPIs || config.featureToggles.datasourceAPIServers)) {
    console.warn('migrateQuery is only available with the experimental API server');
    return query;
  }

  // Obtaining the GroupName from the plugin ID as done in the backend, this is temporary until we have a better way to obtain it
  // https://github.com/grafana/grafana/blob/e013cd427cb0457177e11f19ebd30bc523b36c76/pkg/plugins/apiserver.go#L10
  const dsnameURL = query.datasource?.type?.replace(/^(grafana-)?(.*?)(-datasource)?$/, '$2');
  const groupName = `${dsnameURL}.datasource.grafana.app`;
  // Asuming apiVersion is v0alpha1, we'll need to obtain it from a trusted source
  const apiVersion = 'v0alpha1';
  const url = `/apis/${groupName}/${apiVersion}/namespaces/${config.namespace}/queryconvert`;
  const request = {
    queries: [
      {
        ...query,
        JSON: query, // JSON is not part of the type but it should be what holds the query
      },
    ],
  };
  return getBackendSrv()
    .post(url, request)
    .then((res) => {
      return res.queries[0].JSON;
    });
}

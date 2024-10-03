import { DataQueryRequest, DataSourceInstanceSettings } from '@grafana/data';
import { DataQuery, DataSourceJsonData } from '@grafana/schema';

import { config } from '../config';
import { getBackendSrv } from '../services';

import { DataSourceWithBackend } from './DataSourceWithBackend';

export class DataSourceWithBackendMigration<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData,
> extends DataSourceWithBackend<TQuery, TOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<TOptions>) {
    super(instanceSettings);
  }

  private async postMigrateRequest<TQuery extends DataQuery = DataQuery>(queries: TQuery[]): Promise<TQuery[]> {
    // Obtaining the GroupName from the plugin ID as done in the backend, this is temporary until we have a better way to obtain it
    // https://github.com/grafana/grafana/blob/e013cd427cb0457177e11f19ebd30bc523b36c76/pkg/plugins/apiserver.go#L10
    const dsnameURL = this.type.replace(/^(grafana-)?(.*?)(-datasource)?$/, '$2');
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
  postMigrateQuery<TQuery extends DataQuery = DataQuery>(query: TQuery): Promise<TQuery> | TQuery {
    if (!(config.featureToggles.grafanaAPIServerWithExperimentalAPIs || config.featureToggles.datasourceAPIServers)) {
      console.warn('migrateQuery is only available with the experimental API server');
      return query;
    }
    return this.postMigrateRequest([query]).then((res) => {
      return res[0];
    });
  }

  /**
   * @alpha Experimental: Calls migration endpoint with multiple queries. Requires grafanaAPIServerWithExperimentalAPIs or datasourceAPIServers feature toggle.
   */
  async postMigrateQueries<TQuery extends DataQuery = DataQuery>(
    request: DataQueryRequest<TQuery>
  ): Promise<DataQueryRequest<TQuery>> {
    if (!(config.featureToggles.grafanaAPIServerWithExperimentalAPIs || config.featureToggles.datasourceAPIServers)) {
      console.warn('migrateQueries is only available with the experimental API server');
      return request;
    }

    return this.postMigrateRequest(request.targets).then((res) => {
      request.targets = res;
      return request;
    });
  }
}

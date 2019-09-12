import cloneDeep from 'lodash/cloneDeep';
import groupBy from 'lodash/groupBy';
import { from, of, Observable, merge } from 'rxjs';

import { DataSourceApi, DataQuery, DataQueryRequest, DataQueryResponse, DataSourceInstanceSettings } from '@grafana/ui';
import { getDataSourceSrv } from '@grafana/runtime';
import { mergeMap, map, filter } from 'rxjs/operators';

export const MIXED_DATASOURCE_NAME = '-- Mixed --';

export class MixedDatasource extends DataSourceApi<DataQuery> {
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  query(request: DataQueryRequest<DataQuery>): Observable<DataQueryResponse> {
    // Remove any invalid queries
    const queries = request.targets.filter(t => {
      return t.datasource !== MIXED_DATASOURCE_NAME;
    });

    if (!queries.length) {
      return of({ data: [] } as DataQueryResponse); // nothing
    }

    const sets: { [key: string]: DataQuery[] } = groupBy(queries, 'datasource');
    const observables: Array<Observable<DataQueryResponse>> = [];

    for (const key in sets) {
      const targets = sets[key];
      const dsName = targets[0].datasource;

      const observable = from(getDataSourceSrv().get(dsName)).pipe(
        map((dataSourceApi: DataSourceApi) => {
          const datasourceRequest = cloneDeep(request);

          // Remove any unused hidden queries
          let newTargets = targets.slice();
          if (!dataSourceApi.meta.hiddenQueries) {
            newTargets = newTargets.filter((t: DataQuery) => !t.hide);
          }

          datasourceRequest.targets = newTargets;
          datasourceRequest.requestId = `${dsName}${datasourceRequest.requestId || ''}`;
          return {
            dataSourceApi,
            datasourceRequest,
          };
        })
      );

      const noTargets = observable.pipe(
        filter(({ datasourceRequest }) => datasourceRequest.targets.length === 0),
        mergeMap(() => {
          return of({ data: [] } as DataQueryResponse);
        })
      );

      const hasTargets = observable.pipe(
        filter(({ datasourceRequest }) => datasourceRequest.targets.length > 0),
        mergeMap(({ dataSourceApi, datasourceRequest }) => {
          return from(dataSourceApi.query(datasourceRequest)).pipe(
            map((response: DataQueryResponse) => {
              return {
                ...response,
                data: response.data || [],
                key: `${dsName}${response.key || ''}`,
              } as DataQueryResponse;
            })
          );
        })
      );

      observables.push(merge(noTargets, hasTargets));
    }

    return merge(...observables);
  }

  testDatasource() {
    return Promise.resolve({});
  }
}

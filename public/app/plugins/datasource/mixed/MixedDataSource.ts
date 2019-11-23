import cloneDeep from 'lodash/cloneDeep';
import groupBy from 'lodash/groupBy';
import { from, of, Observable, merge } from 'rxjs';
import { tap } from 'rxjs/operators';

import {
  LoadingState,
  DataSourceApi,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { mergeMap, map } from 'rxjs/operators';

export const MIXED_DATASOURCE_NAME = '-- Mixed --';

export interface BatchedQueries {
  datasource: Promise<DataSourceApi>;
  targets: DataQuery[];
}

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

    // Build groups of queries to run in parallel
    const sets: { [key: string]: DataQuery[] } = groupBy(queries, 'datasource');
    const mixed: BatchedQueries[] = [];
    for (const key in sets) {
      const targets = sets[key];
      const dsName = targets[0].datasource;
      mixed.push({
        datasource: getDataSourceSrv().get(dsName),
        targets,
      });
    }
    return this.batchQueries(mixed, request);
  }

  batchQueries(mixed: BatchedQueries[], request: DataQueryRequest<DataQuery>): Observable<DataQueryResponse> {
    const observables: Array<Observable<DataQueryResponse>> = [];
    let runningSubRequests = 0;

    for (let i = 0; i < mixed.length; i++) {
      const query = mixed[i];
      if (!query.targets || !query.targets.length) {
        continue;
      }
      const observable = from(query.datasource).pipe(
        mergeMap((dataSourceApi: DataSourceApi) => {
          const datasourceRequest = cloneDeep(request);

          datasourceRequest.requestId = `mixed-${i}-${datasourceRequest.requestId || ''}`;
          datasourceRequest.targets = query.targets;

          runningSubRequests++;
          let hasCountedAsDone = false;

          return from(dataSourceApi.query(datasourceRequest)).pipe(
            tap(
              (response: DataQueryResponse) => {
                if (
                  hasCountedAsDone ||
                  response.state === LoadingState.Streaming ||
                  response.state === LoadingState.Loading
                ) {
                  return;
                }
                runningSubRequests--;
                hasCountedAsDone = true;
              },
              () => {
                if (hasCountedAsDone) {
                  return;
                }
                hasCountedAsDone = true;
                runningSubRequests--;
              }
            ),
            map((response: DataQueryResponse) => {
              return {
                ...response,
                data: response.data || [],
                state: runningSubRequests === 0 ? LoadingState.Done : LoadingState.Loading,
                key: `mixed-${i}-${response.key || ''}`,
              } as DataQueryResponse;
            })
          );
        })
      );

      observables.push(observable);
    }

    return merge(...observables);
  }

  testDatasource() {
    return Promise.resolve({});
  }
}

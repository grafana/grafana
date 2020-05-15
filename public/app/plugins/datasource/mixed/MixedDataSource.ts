import cloneDeep from 'lodash/cloneDeep';
import groupBy from 'lodash/groupBy';
import { from, of, Observable, forkJoin } from 'rxjs';
import { map, mergeMap, mergeAll } from 'rxjs/operators';

import {
  LoadingState,
  DataSourceApi,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

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
    const runningQueries = mixed.filter(this.isQueryable).map((query, i) =>
      from(query.datasource).pipe(
        mergeMap((api: DataSourceApi) => {
          const dsRequest = cloneDeep(request);
          dsRequest.requestId = `mixed-${i}-${dsRequest.requestId || ''}`;
          dsRequest.targets = query.targets;

          return from(api.query(dsRequest)).pipe(
            map(response => {
              return {
                ...response,
                data: response.data || [],
                state: LoadingState.Loading,
                key: `mixed-${i}-${response.key || ''}`,
              } as DataQueryResponse;
            })
          );
        })
      )
    );

    return forkJoin(runningQueries).pipe(map(this.markAsDone), mergeAll());
  }

  testDatasource() {
    return Promise.resolve({});
  }

  private isQueryable(query: BatchedQueries): boolean {
    return query && Array.isArray(query.targets) && query.targets.length > 0;
  }

  private markAsDone(responses: DataQueryResponse[]): DataQueryResponse[] {
    const { length } = responses;

    if (length === 0) {
      return responses;
    }

    responses[length - 1].state = LoadingState.Done;
    return responses;
  }
}

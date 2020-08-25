import cloneDeep from 'lodash/cloneDeep';
import groupBy from 'lodash/groupBy';
import { forkJoin, from, Observable, of } from 'rxjs';
import { catchError, map, mergeAll, mergeMap } from 'rxjs/operators';

import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  LoadingState,
} from '@grafana/data';
import { getDataSourceSrv, toDataQueryError } from '@grafana/runtime';

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
        datasource: getDataSourceSrv().get(dsName, request.scopedVars),
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
            }),
            catchError(err => {
              err = toDataQueryError(err);

              err.message = `${api.name}: ${err.message}`;

              return of({
                data: [],
                state: LoadingState.Error,
                error: err,
                key: `mixed-${i}-${dsRequest.requestId || ''}`,
              });
            })
          );
        })
      )
    );

    return forkJoin(runningQueries).pipe(map(this.finalizeResponses), mergeAll());
  }

  testDatasource() {
    return Promise.resolve({});
  }

  private isQueryable(query: BatchedQueries): boolean {
    return query && Array.isArray(query.targets) && query.targets.length > 0;
  }

  private finalizeResponses(responses: DataQueryResponse[]): DataQueryResponse[] {
    const { length } = responses;

    if (length === 0) {
      return responses;
    }

    const error = responses.find(response => response.state === LoadingState.Error);
    if (error) {
      responses.push(error); // adds the first found error entry so error shows up in the panel
    } else {
      responses[length - 1].state = LoadingState.Done;
    }

    return responses;
  }
}

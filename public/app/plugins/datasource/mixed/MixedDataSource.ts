import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  LoadingState,
} from '@grafana/data';
import { getDataSourceSrv, toDataQueryError } from '@grafana/runtime';
import { cloneDeep, groupBy } from 'lodash';
import { mergeMap, from, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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
    const queries = request.targets.filter((t) => {
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
    const runnableQueries = mixed.filter(this.isQueryable);
    const numberOfQueries = runnableQueries
      .map((queries) => queries.targets.length)
      .reduce((previousValue, currentValue) => previousValue + currentValue);
    let firstError: DataQueryResponse | undefined;
    let finishedQueries = 0;

    // Convert array to an observable so we can iterate through the items and map them to DataQueryResponse
    return from(runnableQueries).pipe(
      mergeMap((query, i) =>
        // Get the datasource, this is async this is why we need observables here
        from(query.datasource).pipe(
          mergeMap((api: DataSourceApi) => {
            const dsRequest = cloneDeep(request);
            dsRequest.requestId = `mixed-${i}-${dsRequest.requestId || ''}`;
            dsRequest.targets = query.targets;

            return from(api.query(dsRequest)).pipe(
              map((response) => {
                finishedQueries++;
                // If there was an error we should return that as a last result
                if (finishedQueries === numberOfQueries && firstError) {
                  return firstError;
                }
                return {
                  ...response,
                  data: response.data || [],
                  state: finishedQueries === numberOfQueries ? LoadingState.Done : LoadingState.Loading,
                  key: `mixed-${i}-${response.key || ''}`,
                } as DataQueryResponse;
              }),
              catchError((err) => {
                finishedQueries++;
                err = toDataQueryError(err);

                err.message = `${api.name}: ${err.message}`;

                const errorResponse = {
                  data: [],
                  state: LoadingState.Error,
                  error: err,
                  key: `mixed-${i}-${dsRequest.requestId || ''}`,
                } as DataQueryResponse;
                if (!firstError) {
                  firstError = errorResponse;
                }
                return of(errorResponse);
              })
            );
          })
        )
      )
    );
  }

  testDatasource() {
    return Promise.resolve({});
  }

  private isQueryable(query: BatchedQueries): boolean {
    return query && Array.isArray(query.targets) && query.targets.length > 0;
  }
}

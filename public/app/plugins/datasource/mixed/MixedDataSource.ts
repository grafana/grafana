import { cloneDeep, groupBy } from 'lodash';
import { forkJoin, from, Observable, of, OperatorFunction } from 'rxjs';
import { catchError, map, mergeAll, mergeMap, reduce, toArray } from 'rxjs/operators';

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
    const queries = request.targets.filter((t) => {
      return t.datasource?.uid !== MIXED_DATASOURCE_NAME;
    });

    if (!queries.length) {
      return of({ data: [] }); // nothing
    }

    // Build groups of queries to run in parallel
    const sets: { [key: string]: DataQuery[] } = groupBy(queries, 'datasource.uid');
    const mixed: BatchedQueries[] = [];

    for (const key in sets) {
      const targets = sets[key];

      mixed.push({
        datasource: getDataSourceSrv().get(targets[0].datasource, request.scopedVars),
        targets,
      });
    }

    // Missing UIDs?
    if (!mixed.length) {
      return of({ data: [] }); // nothing
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
            map((response) => {
              return {
                ...response,
                data: response.data || [],
                state: LoadingState.Loading,
                key: `mixed-${i}-${response.key || ''}`,
              };
            }),
            toArray(),
            catchError((err) => {
              err = toDataQueryError(err);
              err.message = `${api.name}: ${err.message}`;

              return of<DataQueryResponse[]>([
                {
                  data: [],
                  state: LoadingState.Error,
                  error: err,
                  key: `mixed-${i}-${dsRequest.requestId || ''}`,
                },
              ]);
            })
          );
        })
      )
    );

    return forkJoin(runningQueries).pipe(flattenResponses(), map(this.finalizeResponses), mergeAll());
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

    const error = responses.find((response) => response.state === LoadingState.Error);
    if (error) {
      responses.push(error); // adds the first found error entry so error shows up in the panel
    } else {
      responses[length - 1].state = LoadingState.Done;
    }

    return responses;
  }
}

function flattenResponses(): OperatorFunction<DataQueryResponse[][], DataQueryResponse[]> {
  return reduce((all: DataQueryResponse[], current) => {
    return current.reduce((innerAll, innerCurrent) => {
      innerAll.push.apply(innerAll, innerCurrent);
      return innerAll;
    }, all);
  }, []);
}

import { cloneDeep, groupBy } from 'lodash';
import { forkJoin, from, Observable, of, OperatorFunction } from 'rxjs';
import { catchError, map, mergeAll, mergeMap, reduce, toArray } from 'rxjs/operators';

import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  TestDataSourceResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  LoadingState,
  ScopedVars,
} from '@grafana/data';
import { getDataSourceSrv, getTemplateSrv, toDataQueryError } from '@grafana/runtime';
import { CustomFormatterVariable } from '@grafana/scenes';

import { SHARED_DASHBOARD_QUERY } from '../dashboard/constants';

export const MIXED_DATASOURCE_NAME = '-- Mixed --';
export const MIXED_REQUEST_PREFIX = 'mixed-';

export const mixedRequestId = (queryIdx: number, requestId?: string) =>
  `${MIXED_REQUEST_PREFIX}${queryIdx}-${requestId || ''}`;

export interface BatchedQueries {
  datasource: Promise<DataSourceApi>;
  queries: DataQuery[];
  scopedVars: ScopedVars;
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
    const batches: BatchedQueries[] = [];

    for (const key in sets) {
      // dashboard ds expects to have only 1 query with const query = options.targets[0]; therefore
      //   we should not batch them together
      if (key === SHARED_DASHBOARD_QUERY) {
        sets[key].forEach((a) => {
          batches.push(...this.getBatchesForQueries([a], request));
        });
      } else {
        batches.push(...this.getBatchesForQueries(sets[key], request));
      }
    }

    // Missing UIDs?
    if (!batches.length) {
      return of({ data: [] }); // nothing
    }

    return this.batchQueries(batches, request);
  }

  /**
   * Almost always returns a single batch for each set of queries.
   * Unless the query is using a multi value variable.
   */
  private getBatchesForQueries(queries: DataQuery[], request: DataQueryRequest<DataQuery>) {
    const dsRef = queries[0].datasource;
    const batches: BatchedQueries[] = [];

    // Using the templateSrv.replace function here with a custom formatter as that is the cleanest way
    // to access the raw value or value array of a variable.
    const datasourceUid = getTemplateSrv().replace(
      dsRef?.uid,
      request.scopedVars,
      (value: string | string[], variable: CustomFormatterVariable) => {
        // If it's not a data source variable, or single value
        if (!Array.isArray(value)) {
          return value;
        }

        for (const uid of value) {
          if (uid === 'default') {
            continue;
          }

          const dsSettings = getDataSourceSrv().getInstanceSettings(uid);

          batches.push({
            datasource: getDataSourceSrv().get(uid),
            queries: cloneDeep(queries),
            scopedVars: {
              ...request.scopedVars,
              [variable.name]: { value: uid, text: dsSettings?.name },
            },
          });
        }

        return '';
      }
    );

    if (datasourceUid !== '') {
      batches.push({
        datasource: getDataSourceSrv().get(datasourceUid),
        queries: cloneDeep(queries),
        scopedVars: {
          ...request.scopedVars,
        },
      });
    }

    return batches;
  }

  batchQueries(mixed: BatchedQueries[], request: DataQueryRequest<DataQuery>): Observable<DataQueryResponse> {
    const runningQueries = mixed.filter(this.isQueryable).map((query, i) =>
      from(query.datasource).pipe(
        mergeMap((api: DataSourceApi) => {
          const dsRequest = cloneDeep(request);
          dsRequest.requestId = mixedRequestId(i, dsRequest.requestId);
          dsRequest.targets = query.queries;
          dsRequest.scopedVars = query.scopedVars;

          return from(api.query(dsRequest)).pipe(
            map((response) => {
              return {
                ...response,
                data: response.data || [],
                state: LoadingState.Loading,
                key: mixedRequestId(i, response.key),
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
                  key: mixedRequestId(i, dsRequest.requestId),
                },
              ]);
            })
          );
        })
      )
    );

    return forkJoin(runningQueries).pipe(flattenResponses(), map(this.finalizeResponses), mergeAll());
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ message: '', status: '' });
  }

  private isQueryable(query: BatchedQueries): boolean {
    return query && Array.isArray(query.queries) && query.queries.length > 0;
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

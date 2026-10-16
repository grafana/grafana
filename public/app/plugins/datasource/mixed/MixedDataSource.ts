import { cloneDeep, groupBy } from 'lodash';
import { concat, defer, EMPTY, from, merge, type Observable, of } from 'rxjs';
import { catchError, finalize, map, mergeMap } from 'rxjs/operators';

import {
  type DataQuery,
  type DataQueryRequest,
  type DataQueryResponse,
  type TestDataSourceResponse,
  DataSourceApi,
  type DataSourceInstanceSettings,
  LoadingState,
  type ScopedVars,
} from '@grafana/data';
import { getDataSourceSrv, getTemplateSrv, toDataQueryError } from '@grafana/runtime';
import { type CustomFormatterVariable } from '@grafana/scenes';

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
    const batches = mixed.filter(this.isQueryable);

    // `defer` gives every subscription its own lifecycle bookkeeping. The returned observable is
    // cold, so without this the `streaming` flags and `lastResponse` below would be shared by all
    // subscribers, letting one subscriber's stream leak a `Streaming` state into another's results.
    return defer(() => {
      // Tracks which batches are currently an active stream (have emitted `Streaming` and not
      // yet completed), so the combined lifecycle stays `Streaming` while any stream is open.
      const streaming = batches.map(() => false);

      const runningQueries = batches.map((query, i) =>
        from(query.datasource).pipe(
          mergeMap((api: DataSourceApi) => {
            const dsRequest = cloneDeep(request);
            dsRequest.requestId = mixedRequestId(i, dsRequest.requestId);
            dsRequest.targets = query.queries;
            dsRequest.scopedVars = query.scopedVars;

            return from(api.query(dsRequest)).pipe(
              map((response) => {
                if (response.state === LoadingState.Streaming) {
                  streaming[i] = true;
                }

                return {
                  ...response,
                  data: response.data || [],
                  // Preserve the source's state so a live source stays `Streaming` and a finite
                  // source is `Done` (the same default `runRequest` applies to a packet with no
                  // state), letting the panel render as soon as any source produces data.
                  state: response.state ?? LoadingState.Done,
                  key: mixedRequestId(i, response.key),
                };
              }),
              catchError((err) => {
                err = toDataQueryError(err);
                err.message = `${api.name}: ${err.message}`;

                return of<DataQueryResponse>({
                  data: [],
                  state: LoadingState.Error,
                  error: err,
                  key: mixedRequestId(i, dsRequest.requestId),
                });
              })
            );
          }),
          // A completed batch is no longer an active stream. This runs before `merge` completes,
          // so the trailing `Done` below is emitted only once no stream remains open.
          finalize(() => {
            streaming[i] = false;
          })
        )
      );

      // `merge` (rather than the previous `forkJoin` + `toArray`) forwards each datasource's
      // responses as they arrive, so a datasource that emits without ever completing — e.g. a
      // continuous streaming query — neither blocks the other results nor holds the response
      // back until it finishes. Per-datasource `catchError` keeps a failure isolated: a failed
      // source surfaces as an `Error` response without discarding the others.
      let lastResponse: DataQueryResponse | undefined;

      return concat(
        merge(...runningQueries).pipe(
          map((response) => {
            // `runRequest` derives the combined state from the latest packet, so while any stream
            // is open a finite source's terminal `Done` must be reported as `Streaming`. Errors
            // are forwarded as-is: `runRequest` already treats them as authoritative.
            const forwarded =
              response.state !== LoadingState.Error && streaming.some(Boolean)
                ? { ...response, state: LoadingState.Streaming }
                : response;

            lastResponse = forwarded;
            return forwarded;
          })
        ),
        // Every underlying source has completed here (a never-completing stream keeps the source
        // open and skips this). Emit one trailing `Done` so a stream that genuinely terminates
        // does not leave the query reporting an active stream. Finite-only queries already ended
        // on `Done`, and errors stay authoritative, so neither emits this packet.
        defer(() => {
          if (lastResponse && lastResponse.state !== LoadingState.Done && lastResponse.state !== LoadingState.Error) {
            return of<DataQueryResponse>({ ...lastResponse, state: LoadingState.Done });
          }

          return EMPTY;
        })
      );
    });
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ message: '', status: '' });
  }

  private isQueryable(query: BatchedQueries): boolean {
    return query && Array.isArray(query.queries) && query.queries.length > 0;
  }
}

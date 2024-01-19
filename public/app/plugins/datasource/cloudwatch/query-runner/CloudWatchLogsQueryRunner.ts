import { set, uniq } from 'lodash';
import {
  catchError,
  concatMap,
  finalize,
  from,
  lastValueFrom,
  map,
  mergeMap,
  Observable,
  of,
  repeat,
  scan,
  share,
  takeWhile,
  tap,
  zip,
} from 'rxjs';

import {
  DataFrame,
  DataQueryError,
  DataQueryErrorType,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  LoadingState,
  LogRowContextOptions,
  LogRowContextQueryDirection,
  LogRowModel,
  getDefaultTimeRange,
  rangeUtil,
} from '@grafana/data';
import { config, FetchError, TemplateSrv } from '@grafana/runtime';

import {
  CloudWatchJsonData,
  CloudWatchLogsQuery,
  CloudWatchLogsQueryStatus,
  CloudWatchLogsRequest,
  CloudWatchQuery,
  GetLogEventsRequest,
  LogAction,
  QueryParam,
  StartQueryRequest,
} from '../types';
import { addDataLinksToLogsResponse } from '../utils/datalinks';
import { runWithRetry } from '../utils/logsRetry';
import { increasingInterval } from '../utils/rxjs/increasingInterval';
import { interpolateStringArrayUsingSingleOrMultiValuedVariable } from '../utils/templateVariableUtils';

import { CloudWatchRequest } from './CloudWatchRequest';

export const LOG_IDENTIFIER_INTERNAL = '__log__grafana_internal__';
export const LOGSTREAM_IDENTIFIER_INTERNAL = '__logstream__grafana_internal__';

// This class handles execution of CloudWatch logs query data queries
export class CloudWatchLogsQueryRunner extends CloudWatchRequest {
  logsTimeout: string;
  logQueries: Record<string, { id: string; region: string; statsQuery: boolean }> = {};
  tracingDataSourceUid?: string;

  constructor(instanceSettings: DataSourceInstanceSettings<CloudWatchJsonData>, templateSrv: TemplateSrv) {
    super(instanceSettings, templateSrv);

    this.tracingDataSourceUid = instanceSettings.jsonData.tracingDatasourceUid;
    this.logsTimeout = instanceSettings.jsonData.logsTimeout || '30m';
  }

  /**
   * Check if the query is complete and returns results if it is. Otherwise it will poll for results.
   */
  getQueryResults = ({
    frames,
    error,
    logQueries,
    timeoutFunc,
    queryFn,
  }: {
    frames: DataFrame[];
    logQueries: CloudWatchLogsQuery[];
    timeoutFunc: () => boolean;
    queryFn: (request: DataQueryRequest<CloudWatchQuery>) => Observable<DataQueryResponse>;
    error?: DataQueryError;
  }) => {
    // If every frame is already finished, we can return the result as the
    // query was run synchronously. Otherwise, we return `this.logsQuery`
    // which will poll for the results.
    if (
      frames.every((frame) =>
        [
          CloudWatchLogsQueryStatus.Complete,
          CloudWatchLogsQueryStatus.Cancelled,
          CloudWatchLogsQueryStatus.Failed,
        ].includes(frame.meta?.custom?.['Status'])
      )
    ) {
      return of({
        data: frames,
        key: 'test-key',
        state: LoadingState.Done,
      });
    }

    return this.logsQuery(
      frames.map((dataFrame) => ({
        queryId: dataFrame.fields[0].values[0],
        region: dataFrame.meta?.custom?.['Region'] ?? 'default',
        refId: dataFrame.refId!,
        statsGroups: logQueries.find((target) => target.refId === dataFrame.refId)?.statsGroups,
      })),
      timeoutFunc,
      queryFn
    ).pipe(
      map((response: DataQueryResponse) => {
        if (!response.error && error) {
          response.error = error;
        }
        return response;
      })
    );
  };

  /**
   * Handle log query. The log query works by starting the query on the CloudWatch and then periodically polling for
   * results.
   * @param logQueries
   * @param options
   */
  handleLogQueries = (
    logQueries: CloudWatchLogsQuery[],
    options: DataQueryRequest<CloudWatchQuery>,
    queryFn: (request: DataQueryRequest<CloudWatchQuery>) => Observable<DataQueryResponse>
  ): Observable<DataQueryResponse> => {
    const validLogQueries = logQueries.filter(this.filterQuery);

    const startQueryRequests: StartQueryRequest[] = validLogQueries.map((target: CloudWatchLogsQuery) => {
      const interpolatedLogGroupArns = interpolateStringArrayUsingSingleOrMultiValuedVariable(
        this.templateSrv,
        (target.logGroups || this.instanceSettings.jsonData.logGroups || []).map((lg) => lg.arn),
        options.scopedVars
      );

      // need to support legacy format variables too
      const interpolatedLogGroupNames = interpolateStringArrayUsingSingleOrMultiValuedVariable(
        this.templateSrv,
        target.logGroupNames || this.instanceSettings.jsonData.defaultLogGroups || [],
        options.scopedVars,
        'text'
      );

      // if a log group template variable expands to log group that has already been selected in the log group picker, we need to remove duplicates.
      // Otherwise the StartLogQuery API will return a permission error
      const logGroups = uniq(interpolatedLogGroupArns).map((arn) => ({ arn, name: arn }));
      const logGroupNames = uniq(interpolatedLogGroupNames);

      return {
        refId: target.refId,
        region: this.templateSrv.replace(this.getActualRegion(target.region)),
        queryString: this.templateSrv.replace(target.expression || '', options.scopedVars),
        logGroups,
        logGroupNames,
      };
    });

    const startTime = new Date();
    const timeoutFunc = () => {
      return Date.now() >= startTime.valueOf() + rangeUtil.intervalToMs(this.logsTimeout);
    };

    return runWithRetry(
      (targets) => {
        return this.makeLogActionRequest('StartQuery', targets, queryFn, options);
      },
      startQueryRequests,
      timeoutFunc
    ).pipe(
      mergeMap(({ frames, error }: { frames: DataFrame[]; error?: DataQueryError }) =>
        this.getQueryResults({ frames, logQueries, timeoutFunc, error, queryFn })
      ),
      mergeMap((dataQueryResponse) => {
        return from(
          (async () => {
            await addDataLinksToLogsResponse(
              dataQueryResponse,
              options,
              this.replaceVariableAndDisplayWarningIfMulti.bind(this),
              this.expandVariableToArray.bind(this),
              this.getActualRegion.bind(this),
              this.tracingDataSourceUid
            );

            return dataQueryResponse;
          })()
        );
      })
    );
  };

  /**
   * Checks progress and polls data of a started logs query with some retry logic.
   * @param queryParams
   */
  logsQuery(
    queryParams: QueryParam[],
    timeoutFunc: () => boolean,
    queryFn: (request: DataQueryRequest<CloudWatchQuery>) => Observable<DataQueryResponse>
  ): Observable<DataQueryResponse> {
    this.logQueries = {};
    queryParams.forEach((param) => {
      this.logQueries[param.refId] = {
        id: param.queryId,
        region: param.region,
        statsQuery: (param.statsGroups?.length ?? 0) > 0 ?? false,
      };
    });

    const dataFrames = increasingInterval({ startPeriod: 100, endPeriod: 1000, step: 300 }).pipe(
      concatMap((_) => this.makeLogActionRequest('GetQueryResults', queryParams, queryFn)),
      repeat(),
      share()
    );

    const initialValue: { failures: number; prevRecordsMatched: Record<string, number> } = {
      failures: 0,
      prevRecordsMatched: {},
    };
    const consecutiveFailedAttempts = dataFrames.pipe(
      scan(({ failures, prevRecordsMatched }, frames) => {
        failures++;
        for (const frame of frames) {
          const recordsMatched = frame.meta?.stats?.find((stat) => stat.displayName === 'Records scanned')?.value!;
          if (recordsMatched > (prevRecordsMatched[frame.refId!] ?? 0)) {
            failures = 0;
          }
          prevRecordsMatched[frame.refId!] = recordsMatched;
        }

        return { failures, prevRecordsMatched };
      }, initialValue),
      map(({ failures }) => failures),
      share()
    );

    const queryResponse: Observable<DataQueryResponse> = zip(dataFrames, consecutiveFailedAttempts).pipe(
      tap(([dataFrames]) => {
        for (const frame of dataFrames) {
          if (
            [
              CloudWatchLogsQueryStatus.Complete,
              CloudWatchLogsQueryStatus.Cancelled,
              CloudWatchLogsQueryStatus.Failed,
            ].includes(frame.meta?.custom?.['Status']) &&
            this.logQueries.hasOwnProperty(frame.refId!)
          ) {
            delete this.logQueries[frame.refId!];
          }
        }
      }),
      map(([dataFrames, failedAttempts]) => {
        if (timeoutFunc()) {
          for (const frame of dataFrames) {
            set(frame, 'meta.custom.Status', CloudWatchLogsQueryStatus.Cancelled);
          }
        }

        return {
          data: dataFrames,
          key: 'test-key',
          state: dataFrames.every((dataFrame) =>
            [
              CloudWatchLogsQueryStatus.Complete,
              CloudWatchLogsQueryStatus.Cancelled,
              CloudWatchLogsQueryStatus.Failed,
            ].includes(dataFrame.meta?.custom?.['Status'])
          )
            ? LoadingState.Done
            : LoadingState.Loading,
          error: timeoutFunc()
            ? {
                message: `error: query timed out after ${failedAttempts} attempts`,
                type: DataQueryErrorType.Timeout,
              }
            : undefined,
        };
      }),
      takeWhile(({ state }) => state !== LoadingState.Error && state !== LoadingState.Done, true)
    );

    return withTeardown(queryResponse, () => this.stopQueries(queryFn));
  }

  stopQueries(queryFn: (request: DataQueryRequest<CloudWatchQuery>) => Observable<DataQueryResponse>) {
    if (Object.keys(this.logQueries).length > 0) {
      this.makeLogActionRequest(
        'StopQuery',
        Object.values(this.logQueries).map((logQuery) => ({
          queryId: logQuery.id,
          region: logQuery.region,
          queryString: '',
          refId: '',
        })),
        queryFn
      ).pipe(
        finalize(() => {
          this.logQueries = {};
        })
      );
    }
  }

  makeLogActionRequest(
    subtype: LogAction,
    queryParams: CloudWatchLogsRequest[],
    queryFn: (request: DataQueryRequest<CloudWatchQuery>) => Observable<DataQueryResponse>,
    options?: DataQueryRequest<CloudWatchQuery>
  ): Observable<DataFrame[]> {
    const range = options?.range || getDefaultTimeRange();

    const requestParams: DataQueryRequest<CloudWatchLogsQuery> = {
      ...options,
      range,
      skipQueryCache: true,
      requestId: options?.requestId || '', // dummy
      interval: options?.interval || '', // dummy
      intervalMs: options?.intervalMs || 1, // dummy
      scopedVars: options?.scopedVars || {}, // dummy
      timezone: options?.timezone || '', // dummy
      app: options?.app || '', // dummy
      startTime: options?.startTime || 0, // dummy
      targets: queryParams.map((param) => ({
        ...param,
        id: '',
        queryMode: 'Logs',
        refId: param.refId || 'A',
        intervalMs: 1, // dummy
        maxDataPoints: 1, // dummy
        datasource: this.ref,
        type: 'logAction',
        subtype: subtype,
      })),
    };

    return queryFn(requestParams).pipe(
      map((response) => response.data),
      catchError((err: FetchError) => {
        if (config.featureToggles.datasourceQueryMultiStatus && err.status === 207) {
          throw err;
        }

        if (err.status === 400) {
          throw err;
        }

        if (err.data?.error) {
          throw err.data.error;
        } else if (err.data?.message) {
          // In PROD we do not supply .error
          throw err.data.message;
        }

        throw err;
      })
    );
  }

  getLogRowContext = async (
    row: LogRowModel,
    { limit = 10, direction = LogRowContextQueryDirection.Backward }: LogRowContextOptions = {},
    queryFn: (request: DataQueryRequest<CloudWatchQuery>) => Observable<DataQueryResponse>,
    query?: CloudWatchLogsQuery
  ): Promise<{ data: DataFrame[] }> => {
    let logStreamField = null;
    let logField = null;

    for (const field of row.dataFrame.fields) {
      if (field.name === LOGSTREAM_IDENTIFIER_INTERNAL) {
        logStreamField = field;
        if (logField !== null) {
          break;
        }
      } else if (field.name === LOG_IDENTIFIER_INTERNAL) {
        logField = field;
        if (logStreamField !== null) {
          break;
        }
      }
    }

    const requestParams: GetLogEventsRequest = {
      refId: query?.refId || 'A', // dummy
      limit,
      startFromHead: direction !== LogRowContextQueryDirection.Backward,
      region: query?.region || '',
      logGroupName: parseLogGroupName(logField!.values[row.rowIndex]),
      logStreamName: logStreamField!.values[row.rowIndex],
    };

    if (direction === LogRowContextQueryDirection.Backward) {
      requestParams.endTime = row.timeEpochMs;
    } else {
      requestParams.startTime = row.timeEpochMs;
    }

    const dataFrames = await lastValueFrom(this.makeLogActionRequest('GetLogEvents', [requestParams], queryFn));

    return {
      data: dataFrames,
    };
  };

  private filterQuery(query: CloudWatchLogsQuery) {
    const hasMissingLegacyLogGroupNames = !query.logGroupNames?.length;
    const hasMissingLogGroups = !query.logGroups?.length;
    const hasMissingQueryString = !query.expression?.length;

    if ((hasMissingLogGroups && hasMissingLegacyLogGroupNames) || hasMissingQueryString) {
      return false;
    }

    return true;
  }
}

function withTeardown<T = DataQueryResponse>(observable: Observable<T>, onUnsubscribe: () => void): Observable<T> {
  return new Observable<T>((subscriber) => {
    const innerSub = observable.subscribe({
      next: (val) => subscriber.next(val),
      error: (err) => subscriber.next(err),
      complete: () => subscriber.complete(),
    });

    return () => {
      innerSub.unsubscribe();
      onUnsubscribe();
    };
  });
}

function parseLogGroupName(logIdentifier: string): string {
  const colonIndex = logIdentifier.lastIndexOf(':');
  return logIdentifier.slice(colonIndex + 1);
}

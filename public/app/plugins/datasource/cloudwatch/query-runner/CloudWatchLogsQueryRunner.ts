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
  rangeUtil,
} from '@grafana/data';
import { BackendDataSourceResponse, config, FetchError, FetchResponse, toDataQueryResponse } from '@grafana/runtime';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';

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

  constructor(
    instanceSettings: DataSourceInstanceSettings<CloudWatchJsonData>,
    templateSrv: TemplateSrv,
    private readonly timeSrv: TimeSrv
  ) {
    super(instanceSettings, templateSrv);

    this.tracingDataSourceUid = instanceSettings.jsonData.tracingDatasourceUid;
    this.logsTimeout = instanceSettings.jsonData.logsTimeout || '30m';
  }

  /**
   * Handle log query. The log query works by starting the query on the CloudWatch and then periodically polling for
   * results.
   * @param logQueries
   * @param options
   */
  handleLogQueries = (
    logQueries: CloudWatchLogsQuery[],
    options: DataQueryRequest<CloudWatchQuery>
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
      (targets: StartQueryRequest[]) => {
        return this.makeLogActionRequest('StartQuery', targets, options);
      },
      startQueryRequests,
      timeoutFunc
    ).pipe(
      mergeMap(({ frames, error }: { frames: DataFrame[]; error?: DataQueryError }) =>
        // This queries for the results
        this.logsQuery(
          frames.map((dataFrame) => ({
            queryId: dataFrame.fields[0].values.get(0),
            region: dataFrame.meta?.custom?.['Region'] ?? 'default',
            refId: dataFrame.refId!,
            statsGroups: logQueries.find((target) => target.refId === dataFrame.refId)?.statsGroups,
          })),
          timeoutFunc
        ).pipe(
          map((response: DataQueryResponse) => {
            if (!response.error && error) {
              response.error = error;
            }
            return response;
          })
        )
      ),
      mergeMap((dataQueryResponse) => {
        return from(
          (async () => {
            await addDataLinksToLogsResponse(
              dataQueryResponse,
              options,
              this.timeSrv.timeRange(),
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
  logsQuery(queryParams: QueryParam[], timeoutFunc: () => boolean): Observable<DataQueryResponse> {
    this.logQueries = {};
    queryParams.forEach((param) => {
      this.logQueries[param.refId] = {
        id: param.queryId,
        region: param.region,
        statsQuery: (param.statsGroups?.length ?? 0) > 0 ?? false,
      };
    });

    const dataFrames = increasingInterval({ startPeriod: 100, endPeriod: 1000, step: 300 }).pipe(
      concatMap((_) => this.makeLogActionRequest('GetQueryResults', queryParams)),
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

    return withTeardown(queryResponse, () => this.stopQueries());
  }

  stopQueries() {
    if (Object.keys(this.logQueries).length > 0) {
      this.makeLogActionRequest(
        'StopQuery',
        Object.values(this.logQueries).map((logQuery) => ({
          queryId: logQuery.id,
          region: logQuery.region,
          queryString: '',
          refId: '',
        }))
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
    options?: DataQueryRequest<CloudWatchQuery>
  ): Observable<DataFrame[]> {
    const range = options?.range || this.timeSrv.timeRange();

    const requestParams = {
      from: range.from.valueOf().toString(),
      to: range.to.valueOf().toString(),
      queries: queryParams.map((param: CloudWatchLogsRequest) => ({
        // eslint-ignore-next-line
        refId: (param as StartQueryRequest).refId || 'A',
        intervalMs: 1, // dummy
        maxDataPoints: 1, // dummy
        datasource: this.ref,
        type: 'logAction',
        subtype: subtype,
        ...param,
      })),
    };

    const resultsToDataFrames = (
      val:
        | { data: BackendDataSourceResponse | undefined }
        | FetchResponse<BackendDataSourceResponse | undefined>
        | DataQueryError
    ): DataFrame[] => toDataQueryResponse(val).data || [];

    return this.awsRequest(this.dsQueryEndpoint, requestParams, {
      'X-Cache-Skip': 'true',
    }).pipe(
      map((response) => resultsToDataFrames(response)),
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
      limit,
      startFromHead: direction !== LogRowContextQueryDirection.Backward,
      region: query?.region,
      logGroupName: parseLogGroupName(logField!.values.get(row.rowIndex)),
      logStreamName: logStreamField!.values.get(row.rowIndex),
    };

    if (direction === LogRowContextQueryDirection.Backward) {
      requestParams.endTime = row.timeEpochMs;
    } else {
      requestParams.startTime = row.timeEpochMs;
    }

    const dataFrames = await lastValueFrom(this.makeLogActionRequest('GetLogEvents', [requestParams]));

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

import { set } from 'lodash';
import {
  Observable,
  of,
  mergeMap,
  map,
  from,
  concatMap,
  finalize,
  repeat,
  scan,
  share,
  takeWhile,
  tap,
  zip,
  catchError,
  lastValueFrom,
} from 'rxjs';

import {
  DataFrame,
  DataQueryError,
  DataQueryErrorType,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  LoadingState,
  LogRowModel,
  rangeUtil,
  ScopedVars,
} from '@grafana/data';
import { BackendDataSourceResponse, config, FetchError, FetchResponse, toDataQueryResponse } from '@grafana/runtime';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { RowContextOptions } from '../../../../features/logs/components/LogRowContextProvider';
import {
  CloudWatchJsonData,
  CloudWatchLogsQuery,
  CloudWatchLogsQueryStatus,
  CloudWatchLogsRequest,
  CloudWatchQuery,
  DescribeLogGroupsRequest,
  GetLogEventsRequest,
  GetLogGroupFieldsRequest,
  GetLogGroupFieldsResponse,
  LogAction,
  StartQueryRequest,
} from '../types';
import { addDataLinksToLogsResponse } from '../utils/datalinks';
import { runWithRetry } from '../utils/logsRetry';
import { increasingInterval } from '../utils/rxjs/increasingInterval';

import { CloudWatchRequest } from './CloudWatchRequest';

export const LOG_IDENTIFIER_INTERNAL = '__log__grafana_internal__';
export const LOGSTREAM_IDENTIFIER_INTERNAL = '__logstream__grafana_internal__';

// This class handles execution of CloudWatch logs query data queries
export class CloudWatchLogsQueryRunner extends CloudWatchRequest {
  logsTimeout: string;
  defaultLogGroups: string[];
  logQueries: Record<string, { id: string; region: string; statsQuery: boolean }> = {};
  tracingDataSourceUid?: string;

  constructor(
    instanceSettings: DataSourceInstanceSettings<CloudWatchJsonData>,
    templateSrv: TemplateSrv,
    private readonly timeSrv: TimeSrv
  ) {
    super(instanceSettings, templateSrv);

    this.tracingDataSourceUid = instanceSettings.jsonData.tracingDatasourceUid;
    this.logsTimeout = instanceSettings.jsonData.logsTimeout || '15m';
    this.defaultLogGroups = instanceSettings.jsonData.defaultLogGroups || [];
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
    const queryParams = logQueries.map((target: CloudWatchLogsQuery) => ({
      queryString: target.expression || '',
      refId: target.refId,
      logGroupNames: target.logGroupNames || this.defaultLogGroups,
      logGroups: target.logGroups || [], //todo handle defaults
      region: super.replaceVariableAndDisplayWarningIfMulti(
        this.getActualRegion(target.region),
        options.scopedVars,
        true,
        'region'
      ),
    }));

    const hasQueryWithMissingLogGroupSelection = queryParams.some((qp) => {
      const missingLogGroupNames = qp.logGroupNames.length === 0;
      const missingLogGroups = qp.logGroups.length === 0;
      return missingLogGroupNames && missingLogGroups;
    });

    if (hasQueryWithMissingLogGroupSelection) {
      return of({ data: [], error: { message: 'Log group is required' } });
    }

    const startTime = new Date();
    const timeoutFunc = () => {
      return Date.now() >= startTime.valueOf() + rangeUtil.intervalToMs(this.logsTimeout);
    };

    return runWithRetry(
      (targets: StartQueryRequest[]) => {
        return this.makeLogActionRequest('StartQuery', targets, {
          makeReplacements: true,
          scopedVars: options.scopedVars,
          skipCache: true,
        });
      },
      queryParams,
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
  logsQuery(
    queryParams: Array<{
      queryId: string;
      refId: string;
      limit?: number;
      region: string;
      statsGroups?: string[];
    }>,
    timeoutFunc: () => boolean
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
      concatMap((_) => this.makeLogActionRequest('GetQueryResults', queryParams, { skipCache: true })),
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
        Object.values(this.logQueries).map((logQuery) => ({ queryId: logQuery.id, region: logQuery.region })),
        {
          makeReplacements: false,
          skipCache: true,
        }
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
    options: {
      scopedVars?: ScopedVars;
      makeReplacements?: boolean;
      skipCache?: boolean;
    } = {
      makeReplacements: true,
      skipCache: false,
    }
  ): Observable<DataFrame[]> {
    const range = this.timeSrv.timeRange();

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

    if (options.makeReplacements) {
      requestParams.queries.forEach((query: CloudWatchLogsRequest) => {
        const fieldsToReplace: Array<
          keyof (GetLogEventsRequest & StartQueryRequest & DescribeLogGroupsRequest & GetLogGroupFieldsRequest)
        > = ['queryString', 'logGroupNames', 'logGroupName', 'logGroupNamePrefix'];

        // eslint-ignore-next-line
        const anyQuery: any = query;
        for (const fieldName of fieldsToReplace) {
          if (query.hasOwnProperty(fieldName)) {
            if (Array.isArray(anyQuery[fieldName])) {
              anyQuery[fieldName] = anyQuery[fieldName].flatMap((val: string) => {
                if (fieldName === 'logGroupNames') {
                  return this.expandVariableToArray(val, options.scopedVars || {});
                }
                return this.replaceVariableAndDisplayWarningIfMulti(val, options.scopedVars, true, fieldName);
              });
            } else {
              anyQuery[fieldName] = this.replaceVariableAndDisplayWarningIfMulti(
                anyQuery[fieldName],
                options.scopedVars,
                true,
                fieldName
              );
            }
          }
        }

        if (anyQuery.region) {
          anyQuery.region = this.replaceVariableAndDisplayWarningIfMulti(
            anyQuery.region,
            options.scopedVars,
            true,
            'region'
          );
          anyQuery.region = this.getActualRegion(anyQuery.region);
        }
      });
    }

    const resultsToDataFrames = (
      val:
        | { data: BackendDataSourceResponse | undefined }
        | FetchResponse<BackendDataSourceResponse | undefined>
        | DataQueryError
    ): DataFrame[] => toDataQueryResponse(val).data || [];
    let headers = {};
    if (options.skipCache) {
      headers = {
        'X-Cache-Skip': true,
      };
    }

    return this.awsRequest(this.dsQueryEndpoint, requestParams, headers).pipe(
      map((response) => resultsToDataFrames({ data: response })),
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
    { limit = 10, direction = 'BACKWARD' }: RowContextOptions = {},
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
      startFromHead: direction !== 'BACKWARD',
      region: query?.region,
      logGroupName: parseLogGroupName(logField!.values.get(row.rowIndex)),
      logStreamName: logStreamField!.values.get(row.rowIndex),
    };

    if (direction === 'BACKWARD') {
      requestParams.endTime = row.timeEpochMs;
    } else {
      requestParams.startTime = row.timeEpochMs;
    }

    const dataFrames = await lastValueFrom(this.makeLogActionRequest('GetLogEvents', [requestParams]));

    return {
      data: dataFrames,
    };
  };

  async getLogGroupFields(params: GetLogGroupFieldsRequest): Promise<GetLogGroupFieldsResponse> {
    const dataFrames = await lastValueFrom(this.makeLogActionRequest('GetLogGroupFields', [params]));

    const fieldNames = dataFrames[0].fields[0].values.toArray();
    const fieldPercentages = dataFrames[0].fields[1].values.toArray();
    const getLogGroupFieldsResponse = {
      logGroupFields: fieldNames.map((val, i) => ({ name: val, percent: fieldPercentages[i] })) ?? [],
    };

    return getLogGroupFieldsResponse;
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

import { cloneDeep } from 'lodash';
import { Observable, of, ReplaySubject, Unsubscribable } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import {
  applyFieldOverrides,
  compareArrayValues,
  compareDataFrameStructures,
  CoreApp,
  DataConfigSource,
  DataFrame,
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  DataSourceJsonData,
  DataSourceRef,
  DataTransformContext,
  DataTransformerConfig,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  rangeUtil,
  ScopedVars,
  TimeRange,
  TimeZone,
  toDataFrame,
  transformDataFrame,
  preProcessPanelData,
  ApplyFieldOverrideOptions,
} from '@grafana/data';
import { getTemplateSrv, toDataQueryError } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { StreamingDataFrame } from 'app/features/live/data/StreamingDataFrame';
import { isStreamingDataFrame } from 'app/features/live/data/utils';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

import { isSharedDashboardQuery, runSharedRequest } from '../../../plugins/datasource/dashboard';
import { PublicDashboardDataSource } from '../../dashboard/services/PublicDashboardDataSource';
import { PanelModel } from '../../dashboard/state';

import { getDashboardQueryRunner } from './DashboardQueryRunner/DashboardQueryRunner';
import { mergePanelAndDashData } from './mergePanelAndDashData';
import { runRequest } from './runRequest';

export interface QueryRunnerOptions<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> {
  datasource: DataSourceRef | DataSourceApi<TQuery, TOptions> | null;
  queries: TQuery[];
  panelId?: number;
  dashboardUID?: string;
  publicDashboardAccessToken?: string;
  timezone: TimeZone;
  timeRange: TimeRange;
  timeInfo?: string; // String description of time range for display
  maxDataPoints: number;
  minInterval: string | undefined | null;
  scopedVars?: ScopedVars;
  cacheTimeout?: string | null;
  queryCachingTTL?: number | null;
  transformations?: DataTransformerConfig[];
  app?: CoreApp;
}

let counter = 100;

export function getNextRequestId() {
  return 'Q' + counter++;
}

export interface GetDataOptions {
  withTransforms: boolean;
  withFieldConfig: boolean;
}

export class PanelQueryRunner {
  private subject: ReplaySubject<PanelData>;
  private subscription?: Unsubscribable;
  private lastResult?: PanelData;
  private dataConfigSource: DataConfigSource;
  private lastRequest?: DataQueryRequest;

  constructor(dataConfigSource: DataConfigSource) {
    this.subject = new ReplaySubject(1);
    this.dataConfigSource = dataConfigSource;
  }

  /**
   * Returns an observable that subscribes to the shared multi-cast subject (that reply last result).
   */
  getData(options: GetDataOptions): Observable<PanelData> {
    const { withFieldConfig, withTransforms } = options;
    let structureRev = 1;
    let lastFieldConfig: ApplyFieldOverrideOptions | undefined = undefined;
    let lastProcessedFrames: DataFrame[] = [];
    let lastRawFrames: DataFrame[] = [];
    let isFirstPacket = true;
    let lastConfigRev = -1;

    if (this.dataConfigSource.snapshotData) {
      const snapshotPanelData: PanelData = {
        state: LoadingState.Done,
        series: this.dataConfigSource.snapshotData.map((v) => toDataFrame(v)),
        timeRange: getDefaultTimeRange(), // Don't need real time range for snapshots
      };
      return of(snapshotPanelData);
    }

    return this.subject.pipe(
      mergeMap((data: PanelData) => {
        let fieldConfig = this.dataConfigSource.getFieldOverrideOptions();

        if (data.series === lastRawFrames && lastFieldConfig?.fieldConfig === fieldConfig?.fieldConfig) {
          return of({ ...data, structureRev, series: lastProcessedFrames });
        }

        lastFieldConfig = fieldConfig;
        lastRawFrames = data.series;
        let dataWithTransforms = of(data);

        if (withTransforms) {
          dataWithTransforms = this.applyTransformations(data);
        }

        return dataWithTransforms.pipe(
          map((data: PanelData) => {
            let processedData = data;
            let streamingPacketWithSameSchema = false;

            if (withFieldConfig && data.series?.length) {
              if (lastConfigRev === this.dataConfigSource.configRev) {
                const streamingDataFrame = data.series.find((data) => isStreamingDataFrame(data)) as
                  | StreamingDataFrame
                  | undefined;

                if (
                  streamingDataFrame &&
                  !streamingDataFrame.packetInfo.schemaChanged &&
                  // TODO: remove the condition below after fixing
                  // https://github.com/grafana/grafana/pull/41492#issuecomment-970281430
                  lastProcessedFrames[0].fields.length === streamingDataFrame.fields.length
                ) {
                  processedData = {
                    ...processedData,
                    series: lastProcessedFrames.map((frame, frameIndex) => ({
                      ...frame,
                      length: data.series[frameIndex].length,
                      fields: frame.fields.map((field, fieldIndex) => ({
                        ...field,
                        values: data.series[frameIndex].fields[fieldIndex].values,
                        state: {
                          ...field.state,
                          calcs: undefined,
                          range: undefined,
                        },
                      })),
                    })),
                  };

                  streamingPacketWithSameSchema = true;
                }
              }

              if (fieldConfig != null && (isFirstPacket || !streamingPacketWithSameSchema)) {
                lastConfigRev = this.dataConfigSource.configRev!;
                processedData = {
                  ...processedData,
                  series: applyFieldOverrides({
                    timeZone: data.request?.timezone ?? 'browser',
                    data: processedData.series,
                    ...fieldConfig!,
                  }),
                };
                isFirstPacket = false;
              }
            }

            if (
              !streamingPacketWithSameSchema &&
              !compareArrayValues(lastProcessedFrames, processedData.series, compareDataFrameStructures)
            ) {
              structureRev++;
            }

            lastProcessedFrames = processedData.series;

            return { ...processedData, structureRev };
          })
        );
      })
    );
  }

  private applyTransformations(data: PanelData): Observable<PanelData> {
    const transformations = this.dataConfigSource.getTransformations();

    if (!transformations || transformations.length === 0) {
      return of(data);
    }

    const ctx: DataTransformContext = {
      interpolate: (v: string) => getTemplateSrv().replace(v, data?.request?.scopedVars),
    };

    return transformDataFrame(transformations, data.series, ctx).pipe(map((series) => ({ ...data, series })));
  }

  async run(options: QueryRunnerOptions) {
    const {
      queries,
      timezone,
      datasource,
      panelId,
      dashboardUID,
      publicDashboardAccessToken,
      timeRange,
      timeInfo,
      cacheTimeout,
      queryCachingTTL,
      maxDataPoints,
      scopedVars,
      minInterval,
      app,
    } = options;

    if (isSharedDashboardQuery(datasource)) {
      this.pipeToSubject(runSharedRequest(options, queries[0]), panelId, true);
      return;
    }

    const request: DataQueryRequest = {
      app: app ?? CoreApp.Dashboard,
      requestId: getNextRequestId(),
      timezone,
      panelId,
      dashboardUID,
      publicDashboardAccessToken,
      range: timeRange,
      timeInfo,
      interval: '',
      intervalMs: 0,
      targets: cloneDeep(queries),
      maxDataPoints: maxDataPoints,
      scopedVars: scopedVars || {},
      cacheTimeout,
      queryCachingTTL,
      startTime: Date.now(),
      rangeRaw: timeRange.raw,
    };

    try {
      const ds = await getDataSource(datasource, request.scopedVars, publicDashboardAccessToken);
      const isMixedDS = ds.meta?.mixed;

      // Attach the data source to each query
      request.targets = request.targets.map((query) => {
        const isExpressionQuery = query.datasource?.type === ExpressionDatasourceRef.type;
        // When using a data source variable, the panel might have the incorrect datasource
        // stored, so when running the query make sure it is done with the correct one
        if (!query.datasource || (query.datasource.uid !== ds.uid && !isMixedDS && !isExpressionQuery)) {
          query.datasource = ds.getRef();
        }
        return query;
      });

      const lowerIntervalLimit = minInterval ? getTemplateSrv().replace(minInterval, request.scopedVars) : ds.interval;
      const norm = rangeUtil.calculateInterval(timeRange, maxDataPoints, lowerIntervalLimit);

      // make shallow copy of scoped vars,
      // and add built in variables interval and interval_ms
      request.scopedVars = Object.assign({}, request.scopedVars, {
        __interval: { text: norm.interval, value: norm.interval },
        __interval_ms: { text: norm.intervalMs.toString(), value: norm.intervalMs },
      });

      request.interval = norm.interval;
      request.intervalMs = norm.intervalMs;

      this.lastRequest = request;

      this.pipeToSubject(runRequest(ds, request), panelId);
    } catch (err) {
      this.pipeToSubject(
        of({
          state: LoadingState.Error,
          error: toDataQueryError(err),
          series: [],
          timeRange: request.range,
        }),
        panelId
      );
    }
  }

  private pipeToSubject(observable: Observable<PanelData>, panelId?: number, skipPreProcess = false) {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    let panelData = observable;
    const dataSupport = this.dataConfigSource.getDataSupport();

    if (dataSupport.alertStates || dataSupport.annotations) {
      const panel = this.dataConfigSource as unknown as PanelModel;
      panelData = mergePanelAndDashData(observable, getDashboardQueryRunner().getResult(panel.id));
    }

    this.subscription = panelData.subscribe({
      next: (data) => {
        this.lastResult = skipPreProcess ? data : preProcessPanelData(data, this.lastResult);
        // Store preprocessed query results for applying overrides later on in the pipeline
        this.subject.next(this.lastResult);
      },
    });
  }

  cancelQuery() {
    if (!this.subscription) {
      return;
    }

    this.subscription.unsubscribe();

    // If we have an old result with loading or streaming state, send it with done state
    if (
      this.lastResult &&
      (this.lastResult.state === LoadingState.Loading || this.lastResult.state === LoadingState.Streaming)
    ) {
      this.subject.next({
        ...this.lastResult,
        state: LoadingState.Done,
      });
    }
  }

  resendLastResult = () => {
    if (this.lastResult) {
      this.subject.next(this.lastResult);
    }
  };

  clearLastResult() {
    this.lastResult = undefined;
    // A new subject is also needed since it's a replay subject that remembers/sends last value
    this.subject = new ReplaySubject(1);
  }

  /**
   * Called when the panel is closed
   */
  destroy() {
    // Tell anyone listening that we are done
    if (this.subject) {
      this.subject.complete();
    }

    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  useLastResultFrom(runner: PanelQueryRunner) {
    this.lastResult = runner.getLastResult();

    if (this.lastResult) {
      // The subject is a replay subject so anyone subscribing will get this last result
      this.subject.next(this.lastResult);
    }
  }

  /** Useful from tests */
  setLastResult(data: PanelData) {
    this.lastResult = data;
  }

  getLastResult(): PanelData | undefined {
    return this.lastResult;
  }

  getLastRequest(): DataQueryRequest | undefined {
    return this.lastRequest;
  }
}

async function getDataSource(
  datasource: DataSourceRef | string | DataSourceApi | null,
  scopedVars: ScopedVars,
  publicDashboardAccessToken?: string
): Promise<DataSourceApi> {
  if (!publicDashboardAccessToken && datasource && typeof datasource === 'object' && 'query' in datasource) {
    return datasource;
  }

  const ds = await getDatasourceSrv().get(datasource, scopedVars);
  if (publicDashboardAccessToken) {
    return new PublicDashboardDataSource(ds);
  }

  return ds;
}

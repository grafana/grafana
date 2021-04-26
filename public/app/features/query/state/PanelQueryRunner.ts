// Libraries
import { cloneDeep } from 'lodash';
import { MonoTypeOperatorFunction, Observable, of, ReplaySubject, Unsubscribable } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

// Services & Utils
import { getTemplateSrv } from '@grafana/runtime';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { preProcessPanelData, runRequest } from './runRequest';
import { isSharedDashboardQuery, runSharedRequest } from '../../../plugins/datasource/dashboard';

// Types
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
  DataTransformerConfig,
  LoadingState,
  PanelData,
  rangeUtil,
  ScopedVars,
  TimeRange,
  TimeZone,
  transformDataFrame,
} from '@grafana/data';
import { getDashboardQueryRunner } from './DashboardQueryRunner/DashboardQueryRunner';
import { mergePanelAndDashData } from './mergePanelAndDashData';

export interface QueryRunnerOptions<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> {
  datasource: string | DataSourceApi<TQuery, TOptions> | null;
  queries: TQuery[];
  panelId?: number;
  dashboardId?: number;
  timezone: TimeZone;
  timeRange: TimeRange;
  timeInfo?: string; // String description of time range for display
  maxDataPoints: number;
  minInterval: string | undefined | null;
  scopedVars?: ScopedVars;
  cacheTimeout?: string;
  transformations?: DataTransformerConfig[];
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
    let lastData: DataFrame[] = [];
    let processedCount = 0;
    let lastConfigRev = -1;
    const fastCompare = (a: DataFrame, b: DataFrame) => {
      return compareDataFrameStructures(a, b, true);
    };

    return this.subject.pipe(
      this.getTransformationsStream(withTransforms),
      map((data: PanelData) => {
        let processedData = data;
        let sameStructure = false;

        if (withFieldConfig && data.series?.length) {
          // Apply field defaults and overrides
          let fieldConfig = this.dataConfigSource.getFieldOverrideOptions();
          let processFields = fieldConfig != null;

          // If the shape is the same, we can skip field overrides
          if (
            processFields &&
            processedCount > 0 &&
            lastData.length &&
            lastConfigRev === this.dataConfigSource.configRev
          ) {
            const sameTypes = compareArrayValues(lastData, processedData.series, fastCompare);
            if (sameTypes) {
              // Keep the previous field config settings
              processedData = {
                ...processedData,
                series: lastData.map((frame, frameIndex) => ({
                  ...frame,
                  fields: frame.fields.map((field, fieldIndex) => ({
                    ...field,
                    values: data.series[frameIndex].fields[fieldIndex].values,
                  })),
                })),
              };
              processFields = false;
              sameStructure = true;
            }
          }

          if (processFields) {
            lastConfigRev = this.dataConfigSource.configRev!;
            processedCount++; // results with data
            processedData = {
              ...processedData,
              series: applyFieldOverrides({
                timeZone: data.request?.timezone ?? 'browser',
                data: processedData.series,
                ...fieldConfig!,
              }),
            };
          }
        }

        if (!sameStructure) {
          sameStructure = compareArrayValues(lastData, processedData.series, compareDataFrameStructures);
        }
        if (!sameStructure) {
          structureRev++;
        }

        lastData = processedData.series;

        return { ...processedData, structureRev };
      })
    );
  }

  private getTransformationsStream = (withTransforms: boolean): MonoTypeOperatorFunction<PanelData> => {
    return (inputStream) =>
      inputStream.pipe(
        mergeMap((data) => {
          if (!withTransforms) {
            return of(data);
          }

          const transformations = this.dataConfigSource.getTransformations();

          if (!transformations || transformations.length === 0) {
            return of(data);
          }

          return transformDataFrame(transformations, data.series).pipe(map((series) => ({ ...data, series })));
        })
      );
  };

  async run(options: QueryRunnerOptions) {
    const {
      queries,
      timezone,
      datasource,
      panelId,
      dashboardId,
      timeRange,
      timeInfo,
      cacheTimeout,
      maxDataPoints,
      scopedVars,
      minInterval,
    } = options;

    if (isSharedDashboardQuery(datasource)) {
      this.pipeToSubject(runSharedRequest(options), panelId);
      return;
    }

    const request: DataQueryRequest = {
      app: CoreApp.Dashboard,
      requestId: getNextRequestId(),
      timezone,
      panelId,
      dashboardId,
      range: timeRange,
      timeInfo,
      interval: '',
      intervalMs: 0,
      targets: cloneDeep(queries),
      maxDataPoints: maxDataPoints,
      scopedVars: scopedVars || {},
      cacheTimeout,
      startTime: Date.now(),
    };

    // Add deprecated property
    (request as any).rangeRaw = timeRange.raw;

    try {
      const ds = await getDataSource(datasource, request.scopedVars);

      // Attach the data source name to each query
      request.targets = request.targets.map((query) => {
        if (!query.datasource) {
          query.datasource = ds.name;
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

      this.pipeToSubject(runRequest(ds, request), panelId);
    } catch (err) {
      console.error('PanelQueryRunner Error', err);
    }
  }

  private pipeToSubject(observable: Observable<PanelData>, panelId?: number) {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    this.subscription = mergePanelAndDashData(observable, getDashboardQueryRunner().getResult(panelId)).subscribe({
      next: (data) => {
        this.lastResult = preProcessPanelData(data, this.lastResult);
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

    // If we have an old result with loading state, send it with done state
    if (this.lastResult && this.lastResult.state === LoadingState.Loading) {
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

  getLastResult(): PanelData | undefined {
    return this.lastResult;
  }
}

async function getDataSource(
  datasource: string | DataSourceApi | null,
  scopedVars: ScopedVars
): Promise<DataSourceApi> {
  if (datasource && (datasource as any).query) {
    return datasource as DataSourceApi;
  }
  return await getDatasourceSrv().get(datasource as string, scopedVars);
}

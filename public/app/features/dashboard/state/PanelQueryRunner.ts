// Libraries
import { cloneDeep } from 'lodash';
import { ReplaySubject, Unsubscribable, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Services & Utils
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import kbn from 'app/core/utils/kbn';
import templateSrv from 'app/features/templating/template_srv';
import { runRequest, preProcessPanelData } from './runRequest';
import { runSharedRequest, isSharedDashboardQuery } from '../../../plugins/datasource/dashboard';

// Types
import {
  PanelData,
  DataQuery,
  CoreApp,
  DataQueryRequest,
  DataSourceApi,
  DataSourceJsonData,
  TimeRange,
  DataTransformerConfig,
  transformDataFrame,
  ScopedVars,
  applyFieldOverrides,
  DataConfigSource,
  TimeZone,
} from '@grafana/data';

export interface QueryRunnerOptions<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> {
  datasource: string | DataSourceApi<TQuery, TOptions>;
  queries: TQuery[];
  panelId: number;
  dashboardId?: number;
  timezone?: string;
  timeRange: TimeRange;
  timeInfo?: string; // String description of time range for display
  maxDataPoints: number;
  minInterval: string | undefined | null;
  scopedVars?: ScopedVars;
  cacheTimeout?: string;
  delayStateNotification?: number; // default 100ms.
  transformations?: DataTransformerConfig[];
}

let counter = 100;
function getNextRequestId() {
  return 'Q' + counter++;
}

export interface GetDataOptions {
  withTransforms: boolean;
  withFieldConfig: boolean;
}

export class PanelQueryRunner {
  private subject?: ReplaySubject<PanelData>;
  private subscription?: Unsubscribable;
  private lastResult?: PanelData;
  private dataConfigSource: DataConfigSource;
  private timeZone?: TimeZone;

  constructor(dataConfigSource: DataConfigSource) {
    this.subject = new ReplaySubject(1);
    this.dataConfigSource = dataConfigSource;
  }

  /**
   * Returns an observable that subscribes to the shared multi-cast subject (that reply last result).
   */
  getData(options: GetDataOptions): Observable<PanelData> {
    const { withFieldConfig, withTransforms } = options;

    return this.subject.pipe(
      map((data: PanelData) => {
        let processedData = data;

        // Apply transformation
        if (withTransforms) {
          const transformations = this.dataConfigSource.getTransformations();

          if (transformations && transformations.length > 0) {
            processedData = {
              ...processedData,
              series: transformDataFrame(transformations, data.series),
            };
          }
        }

        if (withFieldConfig) {
          // Apply field defaults & overrides
          const fieldConfig = this.dataConfigSource.getFieldOverrideOptions();
          if (fieldConfig) {
            processedData = {
              ...processedData,
              series: applyFieldOverrides({
                timeZone: this.timeZone,
                autoMinMax: true,
                data: processedData.series,
                ...fieldConfig,
              }),
            };
          }
        }

        return processedData;
      })
    );
  }

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

    this.timeZone = timezone;

    if (isSharedDashboardQuery(datasource)) {
      this.pipeToSubject(runSharedRequest(options));
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

      // Attach the datasource name to each query
      request.targets = request.targets.map(query => {
        if (!query.datasource) {
          query.datasource = ds.name;
        }
        return query;
      });

      const lowerIntervalLimit = minInterval ? templateSrv.replace(minInterval, request.scopedVars) : ds.interval;
      const norm = kbn.calculateInterval(timeRange, maxDataPoints, lowerIntervalLimit);

      // make shallow copy of scoped vars,
      // and add built in variables interval and interval_ms
      request.scopedVars = Object.assign({}, request.scopedVars, {
        __interval: { text: norm.interval, value: norm.interval },
        __interval_ms: { text: norm.intervalMs.toString(), value: norm.intervalMs },
      });

      request.interval = norm.interval;
      request.intervalMs = norm.intervalMs;

      this.pipeToSubject(runRequest(ds, request));
    } catch (err) {
      console.log('PanelQueryRunner Error', err);
    }
  }

  private pipeToSubject(observable: Observable<PanelData>) {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    this.subscription = observable.subscribe({
      next: (data: PanelData) => {
        this.lastResult = preProcessPanelData(data, this.lastResult);
        // Store preprocessed query results for applying overrides later on in the pipeline
        this.subject.next(this.lastResult);
      },
    });
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

  getLastResult(): PanelData {
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

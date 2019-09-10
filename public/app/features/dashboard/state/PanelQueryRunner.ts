// Libraries
import { cloneDeep } from 'lodash';
import { ReplaySubject, Unsubscribable, PartialObserver } from 'rxjs';
import { map } from 'rxjs/operators';
import { LoadingState } from '@grafana/data';

// Services & Utils
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import kbn from 'app/core/utils/kbn';
import templateSrv from 'app/features/templating/template_srv';
import { runRequest, postProcessPanelData } from './runRequest';
import { runSharedRequest, isSharedDashboardQuery } from '../../../plugins/datasource/dashboard';

// Types
import {
  PanelData,
  PanelDataFormat,
  DataQuery,
  ScopedVars,
  DataQueryRequest,
  DataSourceApi,
  DataSourceJsonData,
} from '@grafana/ui';

import { TimeRange, DataTransformerConfig } from '@grafana/data';

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
  widthPixels: number;
  maxDataPoints: number | undefined | null;
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

export class PanelQueryRunner {
  private subject?: ReplaySubject<PanelData>;
  private subscription?: Unsubscribable;
  private transformations?: DataTransformerConfig[];

  constructor() {
    this.subject = new ReplaySubject(1);
  }

  /**
   * Listen for updates to the PanelData.  If a query has already run for this panel,
   * the results will be immediatly passed to the observer
   */
  subscribe(observer: PartialObserver<PanelData>, format = PanelDataFormat.Frames): Unsubscribable {
    return this.subject.pipe(map(postProcessPanelData(format))).subscribe(observer);
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
      widthPixels,
      maxDataPoints,
      scopedVars,
      minInterval,
      // delayStateNotification,
    } = options;

    // cancel any still running queries
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    // Support shared queries
    if (isSharedDashboardQuery(datasource)) {
      this.subscription = runSharedRequest(options).subscribe(this.subject);
      return;
    }

    const request: DataQueryRequest = {
      requestId: getNextRequestId(),
      timezone,
      panelId,
      dashboardId,
      range: timeRange,
      timeInfo,
      interval: '',
      intervalMs: 0,
      targets: cloneDeep(queries),
      maxDataPoints: maxDataPoints || widthPixels,
      scopedVars: scopedVars || {},
      cacheTimeout,
      startTime: Date.now(),
    };

    // Add deprecated property
    (request as any).rangeRaw = timeRange.raw;

    try {
      const ds = await getDataSource(datasource, request.scopedVars);

      if (ds.meta && !ds.meta.hiddenQueries) {
        request.targets = request.targets.filter(q => !q.hide);
      }

      // Attach the datasource name to each query
      request.targets = request.targets.map(query => {
        if (!query.datasource) {
          query.datasource = ds.name;
        }
        return query;
      });

      const lowerIntervalLimit = minInterval ? templateSrv.replace(minInterval, request.scopedVars) : ds.interval;
      const norm = kbn.calculateInterval(timeRange, widthPixels, lowerIntervalLimit);

      // make shallow copy of scoped vars,
      // and add built in variables interval and interval_ms
      request.scopedVars = Object.assign({}, request.scopedVars, {
        __interval: { text: norm.interval, value: norm.interval },
        __interval_ms: { text: norm.intervalMs.toString(), value: norm.intervalMs },
      });

      request.interval = norm.interval;
      request.intervalMs = norm.intervalMs;

      this.subscription = runRequest(ds, request).subscribe({
        next: data => {
          this.subject.next(data);
        },
      });
    } catch (err) {
      console.log('PanelQueryRunner Error', err);
    }
  }

  /**
   * Get the last result -- optionally skip the transformation
   */
  //  TODO: add tests
  getCurrentData(transform = true): PanelData {
    // const v = this.state.validateStreamsAndGetPanelData();
    // const transformData = config.featureToggles.transformations && transform;
    // const hasTransformations = this.transformations && this.transformations.length;

    // if (transformData && hasTransformations) {
    //   const processed = transformDataFrame(this.transformations, v.series);
    //   return {
    //     ...v,
    //     series: processed,
    //     legacy: processed.map(p => toLegacyResponseData(p)),
    //   };
    // }

    // return v;
    return {
      state: LoadingState.Done,
      series: [],
    } as PanelData;
  }

  setTransformations(transformations?: DataTransformerConfig[]) {
    this.transformations = transformations;
    console.log(this.transformations);
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

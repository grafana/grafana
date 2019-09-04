// Libraries
import { isArray, cloneDeep } from 'lodash';
import { ReplaySubject, Unsubscribable, PartialObserver } from 'rxjs';

// Services & Utils
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import kbn from 'app/core/utils/kbn';
import templateSrv from 'app/features/templating/template_srv';
import { runRequest } from './runRequest';

// Types
import {
  PanelData,
  DataQuery,
  ScopedVars,
  DataQueryRequest,
  DataSourceApi,
  DataSourceJsonData,
  DataQueryResponseData,
} from '@grafana/ui';

import { TimeRange, toDataFrame, DataFrame, isDataFrame, toLegacyResponseData, guessFieldTypes } from '@grafana/data';

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
}

export enum PanelQueryRunnerFormat {
  frames = 'frames',
  legacy = 'legacy',
  both = 'both',
}

let counter = 100;
function getNextRequestId() {
  return 'Q' + counter++;
}

export class PanelQueryRunner {
  private subject?: ReplaySubject<PanelData>;
  private subscription?: Unsubscribable;

  // Listen to another panel for changes
  // private sharedQueryRunner: SharedQueryRunner;

  constructor(private panelId: number) {
    this.subject = new ReplaySubject(1);
  }

  getPanelId() {
    return this.panelId;
  }

  /**
   * Listen for updates to the PanelData.  If a query has already run for this panel,
   * the results will be immediatly passed to the observer
   */
  subscribe(observer: PartialObserver<PanelData>, format = PanelQueryRunnerFormat.frames): Unsubscribable {
    return this.subject.subscribe({
      next: (data: PanelData) => {
        let { series, legacy } = data;

        if (format === PanelQueryRunnerFormat.legacy || format === PanelQueryRunnerFormat.both) {
          legacy = translateToLegacyData(series);
        } else if (format === PanelQueryRunnerFormat.frames || format === PanelQueryRunnerFormat.both) {
          series = getProcessedDataFrames(series);
        }

        observer.next({ ...data, series, legacy });
      },
    });
  }

  /**
   * Subscribe one runner to another
   */
  chain(runner: PanelQueryRunner): Unsubscribable {
    return this.subscribe(runner.subject);
  }

  getCurrentData(): PanelData {
    return null;
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

    // Support shared queries
    // if (isSharedDashboardQuery(datasource)) {
    //   if (!this.sharedQueryRunner) {
    //     this.sharedQueryRunner = new SharedQueryRunner(this);
    //   }
    //   return this.sharedQueryRunner.process(options);
    // } else if (this.sharedQueryRunner) {
    //   this.sharedQueryRunner.disconnect();
    //   this.sharedQueryRunner = null;
    // }

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

    // let loadingStateTimeoutId = 0;

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

      // Check if we can reuse the already issued query
      // const active = state.getActiveRunner();
      // if (active) {
      //   if (state.isSameQuery(ds, request)) {
      //     // Maybe cancel if it has run too long?
      //     console.log('Trying to execute query while last one has yet to complete, returning same promise');
      //     return active;
      //   } else {
      //     state.cancel('Query Changed while running');
      //   }
      // }
      //
      // // Send a loading status event on slower queries
      // loadingStateTimeoutId = window.setTimeout(() => {
      //   if (state.getActiveRunner()) {
      //     this.subject.next(this.state.validateStreamsAndGetPanelData());
      //   }
      // }, delayStateNotification || 500);
      //
      // const data = await state.execute(ds, request);

      // this is not working 100% the outer subjects is marked as completed when this obserable completes, so only works
      // for one request.
      //
      if (this.subscription) {
        this.subscription.unsubscribe();
      }

      this.subscription = runRequest(ds, request).subscribe(this.subject);

      // Clear the delayed loading state timeout
      // clearTimeout(loadingStateTimeoutId);

      // Broadcast results
      // this.subject.next(data);
    } catch (err) {
      console.log(err);
      // clearTimeout(loadingStateTimeoutId);
      // const data = state.setError(err);
      // this.subject.next(data);
    }
  }

  // /**
  //  * Called after every streaming event.  This should be throttled so we
  //  * avoid accidentally overwhelming the browser
  //  */
  // onStreamingDataUpdated = throttle(
  //   () => {
  //     this.subject.next(this.state.validateStreamsAndGetPanelData());
  //   },
  //   50,
  //   { trailing: true, leading: true }
  // );

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

function translateToLegacyData(data: DataQueryResponseData) {
  return data.map((v: any) => {
    if (isDataFrame(v)) {
      return toLegacyResponseData(v);
    }
    return v;
  });
}

/**
 * All panels will be passed tables that have our best guess at colum type set
 *
 * This is also used by PanelChrome for snapshot support
 */
export function getProcessedDataFrames(results?: DataQueryResponseData[]): DataFrame[] {
  if (!isArray(results)) {
    return [];
  }

  const series: DataFrame[] = [];
  for (const r of results) {
    if (r) {
      series.push(guessFieldTypes(toDataFrame(r)));
    }
  }

  return series;
}

// Libraries
import cloneDeep from 'lodash/cloneDeep';
import throttle from 'lodash/throttle';
import { Subject, Unsubscribable, PartialObserver } from 'rxjs';

// Services & Utils
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import kbn from 'app/core/utils/kbn';
import templateSrv from 'app/features/templating/template_srv';
import { PanelQueryState } from './PanelQueryState';
import { isSharedDashboardQuery, SharedQueryRunner } from 'app/plugins/datasource/dashboard/SharedQueryRunner';

// Types
import { PanelData, DataQuery, DataQueryRequest, DataSourceApi, DataSourceJsonData } from '@grafana/ui';

import { TimeRange, DataTransformerConfig, transformDataFrame, toLegacyResponseData, ScopedVars } from '@grafana/data';
import config from 'app/core/config';

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
  private subject?: Subject<PanelData>;

  private state = new PanelQueryState();
  private transformations?: DataTransformerConfig[];

  // Listen to another panel for changes
  private sharedQueryRunner: SharedQueryRunner;

  constructor(private panelId: number) {
    this.state.onStreamingDataUpdated = this.onStreamingDataUpdated;
    this.subject = new Subject();
  }

  getPanelId() {
    return this.panelId;
  }

  /**
   * Get the last result -- optionally skip the transformation
   */
  //  TODO: add tests
  getCurrentData(transform = true): PanelData {
    const v = this.state.validateStreamsAndGetPanelData();
    const transformData = config.featureToggles.transformations && transform;
    const hasTransformations = this.transformations && this.transformations.length;

    if (transformData && hasTransformations) {
      const processed = transformDataFrame(this.transformations, v.series);
      return {
        ...v,
        series: processed,
        legacy: processed.map(p => toLegacyResponseData(p)),
      };
    }

    return v;
  }

  /**
   * Listen for updates to the PanelData.  If a query has already run for this panel,
   * the results will be immediatly passed to the observer
   */
  subscribe(observer: PartialObserver<PanelData>, format = PanelQueryRunnerFormat.frames): Unsubscribable {
    if (format === PanelQueryRunnerFormat.legacy) {
      this.state.sendLegacy = true;
    } else if (format === PanelQueryRunnerFormat.both) {
      this.state.sendFrames = true;
      this.state.sendLegacy = true;
    } else {
      this.state.sendFrames = true;
    }

    // Send the last result
    if (this.state.isStarted()) {
      // Force check formats again?
      this.state.getDataAfterCheckingFormats();
      observer.next(this.getCurrentData()); // transformed
    }

    return this.subject.subscribe(observer);
  }

  /**
   * Subscribe one runner to another
   */
  chain(runner: PanelQueryRunner): Unsubscribable {
    const { sendLegacy, sendFrames } = runner.state;
    let format = sendFrames ? PanelQueryRunnerFormat.frames : PanelQueryRunnerFormat.legacy;

    if (sendLegacy) {
      format = PanelQueryRunnerFormat.both;
    }

    return this.subscribe(runner.subject, format);
  }

  /**
   * Change the current transformation and notify all listeners
   * Should be used only by panel editor to update the transformers
   */
  setTransform = (transformations?: DataTransformerConfig[]) => {
    this.transformations = transformations;

    if (this.state.isStarted()) {
      this.onStreamingDataUpdated();
    }
  };

  async run(options: QueryRunnerOptions): Promise<PanelData> {
    const { state } = this;

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
      delayStateNotification,
    } = options;

    // Support shared queries
    if (isSharedDashboardQuery(datasource)) {
      if (!this.sharedQueryRunner) {
        this.sharedQueryRunner = new SharedQueryRunner(this);
      }
      return this.sharedQueryRunner.process(options);
    } else if (this.sharedQueryRunner) {
      this.sharedQueryRunner.disconnect();
      this.sharedQueryRunner = null;
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

    let loadingStateTimeoutId = 0;

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
      const active = state.getActiveRunner();
      if (active) {
        if (state.isSameQuery(ds, request)) {
          // Maybe cancel if it has run too long?
          console.log('Trying to execute query while last one has yet to complete, returning same promise');
          return active;
        } else {
          state.cancel('Query Changed while running');
        }
      }

      // Send a loading status event on slower queries
      loadingStateTimeoutId = window.setTimeout(() => {
        if (state.getActiveRunner()) {
          this.subject.next(this.state.validateStreamsAndGetPanelData());
        }
      }, delayStateNotification || 500);

      this.transformations = options.transformations;

      const data = await state.execute(ds, request);
      // Clear the delayed loading state timeout
      clearTimeout(loadingStateTimeoutId);

      // Broadcast results
      this.subject.next(this.getCurrentData());
      return data;
    } catch (err) {
      clearTimeout(loadingStateTimeoutId);

      const data = state.setError(err);
      this.subject.next(data);
      return data;
    }
  }

  /**
   * Called after every streaming event. This should be throttled so we
   * avoid accidentally overwhelming the browser
   */
  onStreamingDataUpdated = throttle(
    () => {
      this.subject.next(this.getCurrentData());
    },
    50,
    { trailing: true, leading: true }
  );

  /**
   * Called when the panel is closed
   */
  destroy() {
    // Tell anyone listening that we are done
    if (this.subject) {
      this.subject.complete();
    }

    // Will cancel and disconnect any open requets
    this.state.cancel('destroy');
  }

  setState = (state: PanelQueryState) => {
    this.state = state;
  };

  getState = () => {
    return this.state;
  };
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

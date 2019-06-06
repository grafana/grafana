// Libraries
import cloneDeep from 'lodash/cloneDeep';
import throttle from 'lodash/throttle';
import { Subject, Unsubscribable, PartialObserver } from 'rxjs';

// Services & Utils
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import kbn from 'app/core/utils/kbn';
import templateSrv from 'app/features/templating/template_srv';
import { PanelQueryState } from './PanelQueryState';

// Types
import {
  PanelData,
  DataQuery,
  TimeRange,
  ScopedVars,
  DataQueryRequest,
  DataSourceApi,
  DataSourceJsonData,
} from '@grafana/ui';

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
  series = 'series',
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

  constructor() {
    this.state.onStreamingDataUpdated = this.onStreamingDataUpdated;
  }

  /**
   * Listen for updates to the PanelData.  If a query has already run for this panel,
   * the results will be immediatly passed to the observer
   */
  subscribe(observer: PartialObserver<PanelData>, format = PanelQueryRunnerFormat.series): Unsubscribable {
    if (!this.subject) {
      this.subject = new Subject(); // Delay creating a subject until someone is listening
    }

    if (format === PanelQueryRunnerFormat.legacy) {
      this.state.sendLegacy = true;
    } else if (format === PanelQueryRunnerFormat.both) {
      this.state.sendSeries = true;
      this.state.sendLegacy = true;
    } else {
      this.state.sendSeries = true;
    }

    // Send the last result
    if (this.state.isStarted()) {
      observer.next(this.state.getDataAfterCheckingFormats());
    }

    return this.subject.subscribe(observer);
  }

  async run(options: QueryRunnerOptions): Promise<PanelData> {
    if (!this.subject) {
      this.subject = new Subject();
    }

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

      const data = await state.execute(ds, request);

      // Clear the delayed loading state timeout
      clearTimeout(loadingStateTimeoutId);

      // Broadcast results
      this.subject.next(data);
      return data;
    } catch (err) {
      clearTimeout(loadingStateTimeoutId);

      const data = state.setError(err);
      this.subject.next(data);
      return data;
    }
  }

  /**
   * Called after every streaming event.  This should be throttled so we
   * avoid accidentally overwhelming the browser
   */
  onStreamingDataUpdated = throttle(
    () => {
      this.subject.next(this.state.validateStreamsAndGetPanelData());
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

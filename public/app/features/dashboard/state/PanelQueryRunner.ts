// Libraries
import cloneDeep from 'lodash/cloneDeep';
import { Subject, Unsubscribable, PartialObserver } from 'rxjs';

// Services & Utils
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import kbn from 'app/core/utils/kbn';
import templateSrv from 'app/features/templating/template_srv';

// Components & Types
import {
  guessFieldTypes,
  toSeriesData,
  PanelData,
  LoadingState,
  DataQuery,
  TimeRange,
  ScopedVars,
  DataQueryRequest,
  SeriesData,
  DataSourceApi,
} from '@grafana/ui';
import { PanelQueryState } from './PanelQueryState';

export interface QueryRunnerOptions<TQuery extends DataQuery = DataQuery> {
  datasource: string | DataSourceApi<TQuery>;
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
    if (this.state.data.state !== LoadingState.NotStarted) {
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
      targets: cloneDeep(
        queries.filter(q => {
          return !q.hide; // Skip any hidden queries
        })
      ),
      maxDataPoints: maxDataPoints || widthPixels,
      scopedVars: scopedVars || {},
      cacheTimeout,
      startTime: Date.now(),
    };
    // Deprecated
    (request as any).rangeRaw = timeRange.raw;

    let loadingStateTimeoutId = 0;

    try {
      const ds =
        datasource && (datasource as any).query
          ? (datasource as DataSourceApi)
          : await getDatasourceSrv().get(datasource as string, request.scopedVars);

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
        __interval_ms: { text: norm.intervalMs, value: norm.intervalMs },
      });

      request.interval = norm.interval;
      request.intervalMs = norm.intervalMs;

      // Check if we can reuse the already issued query
      if (state.isRunning()) {
        if (state.isSameQuery(ds, request)) {
          // TODO? maybe cancel if it has run too long?
          return state.getCurrentExecutor();
        } else {
          state.cancel('Query Changed while running');
        }
      }

      // Send a loading status event on slower queries
      loadingStateTimeoutId = window.setTimeout(() => {
        if (this.state.isRunning()) {
          this.subject.next(this.state.data);
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

/**
 * All panels will be passed tables that have our best guess at colum type set
 *
 * This is also used by PanelChrome for snapshot support
 */
export function getProcessedSeriesData(results?: any[]): SeriesData[] {
  if (!results) {
    return [];
  }

  const series: SeriesData[] = [];
  for (const r of results) {
    if (r) {
      series.push(guessFieldTypes(toSeriesData(r)));
    }
  }

  return series;
}

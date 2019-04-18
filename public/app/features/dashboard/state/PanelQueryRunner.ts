import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { Subject, Unsubscribable, PartialObserver } from 'rxjs';
import {
  guessFieldTypes,
  toSeriesData,
  PanelData,
  LoadingState,
  DataQuery,
  TimeRange,
  ScopedVars,
  DataRequestInfo,
  SeriesData,
  DataQueryError,
  toLegacyResponseData,
  isSeriesData,
  DataSourceApi,
} from '@grafana/ui';

import cloneDeep from 'lodash/cloneDeep';

import kbn from 'app/core/utils/kbn';

export interface QueryRunnerOptions<TQuery extends DataQuery = DataQuery> {
  ds?: DataSourceApi<TQuery>; // if they already have the datasource, don't look it up
  datasource: string | null;
  queries: TQuery[];
  panelId: number;
  dashboardId?: number;
  timezone?: string;
  timeRange?: TimeRange;
  timeInfo?: string; // String description of time range for display
  widthPixels: number;
  minInterval?: string;
  maxDataPoints?: number;
  scopedVars?: ScopedVars;
  cacheTimeout?: string;
  delayStateNotification?: number; // default 100ms.
}

export enum PanelQueryRunnerFormat {
  series = 'series',
  legacy = 'legacy',
  both = 'both',
}

export class PanelQueryRunner {
  private subject?: Subject<PanelData>;

  private sendSeries = false;
  private sendLegacy = false;

  private data = {
    state: LoadingState.NotStarted,
    series: [],
  } as PanelData;

  /**
   * Listen for updates to the PanelData.  If a query has already run for this panel,
   * the results will be immediatly passed to the observer
   */
  subscribe(observer: PartialObserver<PanelData>, format = PanelQueryRunnerFormat.series): Unsubscribable {
    if (!this.subject) {
      this.subject = new Subject(); // Delay creating a subject until someone is listening
    }

    if (format === PanelQueryRunnerFormat.legacy) {
      this.sendLegacy = true;
    } else if (format === PanelQueryRunnerFormat.both) {
      this.sendSeries = true;
      this.sendLegacy = true;
    } else {
      this.sendSeries = true;
    }

    // Send the last result
    if (this.data.state !== LoadingState.NotStarted) {
      // TODO: make sure it has legacy if necessary
      observer.next(this.data);
    }

    return this.subject.subscribe(observer);
  }

  async run(options: QueryRunnerOptions): Promise<PanelData> {
    if (!this.subject) {
      this.subject = new Subject();
    }

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
      delayStateNotification,
    } = options;

    const request: DataRequestInfo = {
      timezone,
      panelId,
      dashboardId,
      range: timeRange,
      rangeRaw: timeRange.raw,
      timeInfo,
      interval: '',
      intervalMs: 0,
      targets: cloneDeep(queries),
      maxDataPoints: maxDataPoints || widthPixels,
      scopedVars: scopedVars || {},
      cacheTimeout,
      startTime: Date.now(),
    };

    if (!queries) {
      this.data = {
        state: LoadingState.Done,
        series: [], // Clear the data
        legacy: [],
        request,
      };
      this.subject.next(this.data);
      return this.data;
    }

    let loadingStateTimeoutId = 0;

    try {
      const ds = options.ds ? options.ds : await getDatasourceSrv().get(datasource, request.scopedVars);

      const minInterval = options.minInterval || ds.interval;
      const norm = kbn.calculateInterval(timeRange, widthPixels, minInterval);

      // make shallow copy of scoped vars,
      // and add built in variables interval and interval_ms
      request.scopedVars = Object.assign({}, request.scopedVars, {
        __interval: { text: norm.interval, value: norm.interval },
        __interval_ms: { text: norm.intervalMs, value: norm.intervalMs },
      });
      request.interval = norm.interval;
      request.intervalMs = norm.intervalMs;

      // Send a loading status event on slower queries
      loadingStateTimeoutId = window.setTimeout(() => {
        this.publishUpdate({ state: LoadingState.Loading });
      }, delayStateNotification || 500);

      const resp = await ds.query(request);

      request.endTime = Date.now();

      // Make sure the response is in a supported format
      const series = this.sendSeries ? getProcessedSeriesData(resp.data) : [];
      const legacy = this.sendLegacy
        ? resp.data.map(v => {
            if (isSeriesData(v)) {
              return toLegacyResponseData(v);
            }
            return v;
          })
        : undefined;

      // Make sure the delayed loading state timeout is cleared
      clearTimeout(loadingStateTimeoutId);

      // Publish the result
      return this.publishUpdate({
        state: LoadingState.Done,
        series,
        legacy,
        request,
      });
    } catch (err) {
      const error = err as DataQueryError;
      if (!error.message) {
        let message = 'Query error';
        if (error.message) {
          message = error.message;
        } else if (error.data && error.data.message) {
          message = error.data.message;
        } else if (error.data && error.data.error) {
          message = error.data.error;
        } else if (error.status) {
          message = `Query error: ${error.status} ${error.statusText}`;
        }
        error.message = message;
      }

      // Make sure the delayed loading state timeout is cleared
      clearTimeout(loadingStateTimeoutId);

      return this.publishUpdate({
        state: LoadingState.Error,
        error: error,
      });
    }
  }

  publishUpdate(update: Partial<PanelData>): PanelData {
    this.data = {
      ...this.data,
      ...update,
    };

    this.subject.next(this.data);

    return this.data;
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

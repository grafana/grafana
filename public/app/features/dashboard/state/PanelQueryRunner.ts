// Libraries
import cloneDeep from 'lodash/cloneDeep';
import { Subject, Unsubscribable, PartialObserver } from 'rxjs';
import throttle from 'lodash/throttle';

// Services & Utils
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getBackendSrv } from 'app/core/services/backend_srv';
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
  DataQueryError,
  toLegacyResponseData,
  isSeriesData,
  DataSourceApi,
  DataStreamEvent,
} from '@grafana/ui';

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

  private sendSeries = false;
  private sendLegacy = false;

  private data = {
    state: LoadingState.NotStarted,
    series: [],
  } as PanelData;

  private streamEvents = new Map<string, DataStreamEvent>();

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
    // Deprecated
    (request as any).rangeRaw = timeRange.raw;

    if (this.data.state === LoadingState.Loading) {
      console.log('Previous query is still loading, what should we do?');
      // Maybe check if it is the same query???
      // Maybe cancel the existing one?
      // Maybe hold on to the ds.query( promise?
    }

    if (!queries) {
      return this.publishUpdate({
        state: LoadingState.Done,
        series: [], // Clear the data
        legacy: [],
        request,
      });
    }

    let loadingStateTimeoutId = 0;

    try {
      const ds =
        datasource && (datasource as any).query
          ? (datasource as DataSourceApi)
          : await getDatasourceSrv().get(datasource as string, request.scopedVars);

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

      // Set the internal state
      // If events are streamed back, they are expected to refernce the
      // same requestId
      this.data = {
        ...this.data, // Keep any existing data
        request,
        state: LoadingState.Loading,
        error: undefined, // Clear the error
      };

      // Send a loading status event on slower queries
      loadingStateTimeoutId = window.setTimeout(() => {
        this.publishUpdate({ state: LoadingState.Loading });
      }, delayStateNotification || 500);

      const resp = await ds.query(request, this.streamingDataObserver);

      // When streaming get data from the callback events
      if (resp.streaming) {
        clearTimeout(loadingStateTimeoutId);
        return this.publishUpdate({
          state: LoadingState.Streaming,
          request,
        });
      }

      request.endTime = Date.now();

      // Make sure we send something back -- called run() w/o subscribe!
      if (!(this.sendSeries || this.sendLegacy)) {
        this.sendSeries = true;
      }

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
      // Make sure the delayed loading state timeout is cleared
      clearTimeout(loadingStateTimeoutId);

      return this.publishUpdate({
        state: LoadingState.Error,
        error: toDataQueryError(err),
      });
    }
  }

  publishUpdate(update: Partial<PanelData>): PanelData {
    this.data = {
      ...this.data,
      ...update,
    };

    this.subject.next(this.data);

    console.log('UPDATE', this.data);

    return this.data;
  }

  /**
   * This looks at the values we have saved and builds a full
   * response based on any open streams
   */
  private updateFromStream = throttle(
    () => {
      const { request } = this.data;
      const series = [];

      let error: DataQueryError | undefined;
      this.streamEvents.forEach((event, key) => {
        if (key.startsWith(request.requestId)) {
          series.push.apply(series, event.series);
          if (event.error) {
            error = event.error;
          }
        } else {
          if (event.subscription) {
            event.subscription.unsubscribe();
          }
          this.streamEvents.delete(key);
        }
      });

      // Update the graphs
      this.publishUpdate({
        series,
        error,
        legacy: this.sendLegacy
          ? series.map(v => {
              return toLegacyResponseData(v);
            })
          : undefined,
      });
    },
    50,
    { leading: true, trailing: true }
  );

  // This is passed to DataSourceAPI and may get partial results
  private streamingDataObserver = {
    next: (event: DataStreamEvent): boolean => {
      const { request } = this.data;
      try {
        const { requestId } = event.request;
        // Make sure it is an event we are listening for
        if (!requestId.startsWith(request.requestId)) {
          if (event.subscription) {
            event.subscription.unsubscribe();
          }
          console.log('Ignoring event from different request', request.requestId, event.request.requestId);

          return false;
        }

        // Set the Request ID on all series metadata
        for (const series of event.series) {
          if (series.meta) {
            series.meta.requestId = requestId;
          } else {
            series.meta = { requestId };
          }
        }
        this.streamEvents.set(event.request.requestId, event);
        this.updateFromStream(); // throttled
      } catch (err) {
        console.log('Error in stream handling', err, event);
      }
      return true;
    },
  };

  /**
   * Called when the panel is closed
   */
  destroy() {
    // Tell anyone listening that we are done
    if (this.subject) {
      this.subject.complete();
    }

    // Unsubscribe to any streaming events
    this.streamEvents.forEach(event => {
      if (event.subscription) {
        event.subscription.unsubscribe();
      }
    });

    // If there are open HTTP requests, close them
    const { request } = this.data;
    if (request && request.requestId) {
      getBackendSrv().resolveCancelerIfExists(request.requestId);
    }
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

export function toDataQueryError(err: any): DataQueryError {
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
  return err;
}

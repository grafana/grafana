import isString from 'lodash/isString';
import {
  DataSourceApi,
  DataQueryRequest,
  PanelData,
  LoadingState,
  toLegacyResponseData,
  isSeriesData,
  toSeriesData,
  DataQueryError,
  SeriesDataStream,
  SeriesData,
  SeriesDataStreamObserver,
} from '@grafana/ui';
import { getProcessedSeriesData } from './PanelQueryRunner';
import { getBackendSrv } from 'app/core/services/backend_srv';
import isEqual from 'lodash/isEqual';
import { Unsubscribable } from 'rxjs';
import * as dateMath from 'app/core/utils/datemath';

export interface OpenStream {
  key: string;
  refId: string;
  openTime: number;
  lastQuery: number;
  lastEvent: number; // Time
  eventCount: number;
  subscription: Unsubscribable | null;
  data: SeriesData[];
}

export class PanelQueryState {
  // The current/last running request
  request = {
    startTime: 0,
    endTime: 1000, // Somethign not zero
  } as DataQueryRequest;

  // The best known state of data
  data = {
    state: LoadingState.NotStarted,
    series: [],
  } as PanelData;

  sendSeries = false;
  sendLegacy = false;

  openStreams: OpenStream[] = [];

  // A promise for the running query
  private executor: Promise<PanelData> = {} as any;
  private rejector = (reason?: any) => {};
  private datasource: DataSourceApi = {} as any;

  isRunning() {
    return this.data.state === LoadingState.Loading; //
  }

  isSameQuery(ds: DataSourceApi, req: DataQueryRequest) {
    if (this.datasource !== this.datasource) {
      return false;
    }

    // For now just check that the targets look the same
    return isEqual(this.request.targets, req.targets);
  }

  getCurrentExecutor() {
    return this.executor;
  }

  cancel(reason: string) {
    const { request } = this;
    try {
      if (!request.endTime) {
        request.endTime = Date.now();

        this.rejector('Canceled:' + reason);
      }

      // Cancel any open HTTP request with the same ID
      if (request.requestId) {
        getBackendSrv().resolveCancelerIfExists(request.requestId);
      }
    } catch (err) {
      console.log('Error canceling request');
    }

    // Close any open streams
    this.closeStreams();
  }

  execute(ds: DataSourceApi, req: DataQueryRequest): Promise<PanelData> {
    this.request = req;

    // Return early if there are no queries to run
    if (!req.targets.length) {
      console.log('No queries, so return early');
      this.request.endTime = Date.now();
      return Promise.resolve(
        (this.data = {
          state: LoadingState.Done,
          series: [], // Clear the data
          legacy: [],
          request: req,
        })
      );
    }

    // Set the loading state immediatly
    this.data.state = LoadingState.Loading;
    return (this.executor = new Promise<PanelData>((resolve, reject) => {
      this.rejector = reject;

      return ds
        .query(this.request)
        .then(resp => {
          this.request.endTime = Date.now();

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

          // Check if any streams were returned
          if (this.checkStreams(resp.streams)) {
            resolve((this.data = this.getPanelDataFromStream()));
          }

          resolve(
            (this.data = {
              state: LoadingState.Done,
              request: this.request,
              series,
              legacy,
            })
          );
        })
        .catch(err => {
          resolve(this.setError(err));
        });
    }));
  }

  // Send a notice when the stream has updated the current model
  streamCallback: () => void;

  // This gets all stream events and keeps track of them
  // it will throttle actuall updates to subscribers
  streamDataObserver: SeriesDataStreamObserver = {
    done: (key: string) => {
      console.log('DONE With', key);
    },
    error: (key: string, err: DataQueryError) => {
      console.log('ERROR With', key, err);
    },
    next: (key: string, series: SeriesData[]): boolean => {
      const stream = this.getOpenStream(key);
      if (!stream) {
        console.log('Unknown stream: ', key);
        return false;
      }
      stream.eventCount++;
      stream.lastEvent = Date.now();
      stream.data = series;
      try {
        this.streamCallback();
      } catch (err) {
        console.log('Error in callback', err, stream);
      }
      return true;
    },
  };

  getOpenStream(key: string): OpenStream | undefined {
    return this.openStreams.find(s => s.key === key);
  }

  checkStreams(streams?: SeriesDataStream[]): boolean {
    if (streams && streams.length) {
      const active: OpenStream[] = [];
      const now = Date.now();
      for (const stream of streams) {
        const current = this.getOpenStream(stream.key);
        if (current && current.key === stream.key) {
          current.lastQuery = now;
          active.push(current);
          continue;
        }

        // Add the stream *before* calling subscribe
        const open: OpenStream = {
          key: stream.key,
          refId: stream.refId,
          openTime: now,
          lastQuery: now,
          lastEvent: 0,
          eventCount: 0,
          data: [],
          subscription: null,
        };
        this.openStreams.push(open);
        open.subscription = stream.subscribe(this.streamDataObserver);
        active.push(open);
      }

      if (this.openStreams) {
        // Close any streams that did not come back from the query
        for (const open of this.openStreams) {
          if (open.lastQuery !== now && open.subscription) {
            open.subscription.unsubscribe();
            open.subscription = null;
          }
        }
      }
      this.openStreams = active;
    } else if (this.openStreams.length) {
      this.closeStreams();
    }
    return this.openStreams.length > 0;
  }

  closeStreams() {
    if (this.openStreams.length) {
      // We have open streams, but query does not think so
      for (const stream of this.openStreams) {
        if (stream.subscription) {
          try {
            stream.subscription.unsubscribe();
          } catch {}
          stream.subscription = null;
        }
      }
      this.openStreams = [];
    }
  }

  /**
   * Build PanelData based on the stream state
   */
  getPanelDataFromStream = (): PanelData => {
    const series: SeriesData[] = [];
    for (const stream of this.openStreams) {
      series.push.apply(series, stream.data);
    }

    // Update the time range
    let timeRange = this.request.range;
    if (isString(timeRange.raw.from)) {
      timeRange = {
        from: dateMath.parse(timeRange.raw.from, false),
        to: dateMath.parse(timeRange.raw.to, true),
        raw: timeRange.raw,
      };
    }

    return (this.data = {
      state: LoadingState.Done, // TODO, state based on the actual states!
      series,
      legacy: this.sendLegacy ? series.map(s => toLegacyResponseData(s)) : undefined,
      request: {
        ...this.request,
        range: timeRange, // update the time range
      },
    });
  };

  /**
   * Make sure all requested formats exist on the data
   */
  getDataAfterCheckingFormats(): PanelData {
    const { data, sendLegacy, sendSeries } = this;
    if (sendLegacy && (!data.legacy || !data.legacy.length)) {
      data.legacy = data.series.map(v => toLegacyResponseData(v));
    }
    if (sendSeries && !data.series.length && data.legacy) {
      data.series = data.legacy.map(v => toSeriesData(v));
    }
    return this.data;
  }

  setError(err: any): PanelData {
    if (!this.request.endTime) {
      this.request.endTime = Date.now();
    }
    this.closeStreams();

    return (this.data = {
      ...this.data, // Keep any existing data
      state: LoadingState.Error,
      error: toDataQueryError(err),
      request: this.request,
    });
  }
}

export function toDataQueryError(err: any): DataQueryError {
  const error = (err || {}) as DataQueryError;
  if (!error.message) {
    if (typeof err === 'string' || err instanceof String) {
      return { message: err } as DataQueryError;
    }

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
  return error;
}

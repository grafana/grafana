// Libraries
import isString from 'lodash/isString';
import isEqual from 'lodash/isEqual';

// Utils & Services
import { getBackendSrv } from 'app/core/services/backend_srv';
import * as dateMath from '@grafana/ui/src/utils/datemath';
import { guessFieldTypes, toSeriesData, isSeriesData } from '@grafana/ui/src/utils';

// Types
import {
  DataSourceApi,
  DataQueryRequest,
  PanelData,
  LoadingState,
  toLegacyResponseData,
  DataQueryError,
  DataStreamObserver,
  DataStreamState,
  SeriesData,
  DataQueryResponseData,
} from '@grafana/ui';

export class PanelQueryState {
  // The current/last running request
  request = {
    startTime: 0,
    endTime: 1000, // Somethign not zero
  } as DataQueryRequest;

  // The result back from the datasource query
  response = {
    state: LoadingState.NotStarted,
    series: [],
  } as PanelData;

  // Active stream results
  streams: DataStreamState[] = [];

  sendSeries = false;
  sendLegacy = false;

  // A promise for the running query
  private executor?: Promise<PanelData> = null;
  private rejector = (reason?: any) => {};
  private datasource: DataSourceApi = {} as any;

  isFinished(state: LoadingState) {
    return state === LoadingState.Done || state === LoadingState.Error;
  }

  isStarted() {
    return this.response.state !== LoadingState.NotStarted;
  }

  isSameQuery(ds: DataSourceApi, req: DataQueryRequest) {
    if (ds !== this.datasource) {
      return false;
    }

    // For now just check that the targets look the same
    return isEqual(this.request.targets, req.targets);
  }

  /**
   * Return the currently running query
   */
  getActiveRunner(): Promise<PanelData> | undefined {
    return this.executor;
  }

  cancel(reason: string) {
    const { request } = this;
    this.executor = null;

    try {
      // If no endTime the call to datasource.query did not complete
      // call rejector to reject the executor promise
      if (!request.endTime) {
        request.endTime = Date.now();
        this.rejector('Canceled:' + reason);
      }

      // Cancel any open HTTP request with the same ID
      if (request.requestId) {
        getBackendSrv().resolveCancelerIfExists(request.requestId);
      }
    } catch (err) {
      console.log('Error canceling request', err);
    }

    // Close any open streams
    this.closeStreams(true);
  }

  execute(ds: DataSourceApi, req: DataQueryRequest): Promise<PanelData> {
    this.request = req;
    this.datasource = ds;

    // Return early if there are no queries to run
    if (!req.targets.length) {
      console.log('No queries, so return early');
      this.request.endTime = Date.now();
      this.closeStreams();
      return Promise.resolve(
        (this.response = {
          state: LoadingState.Done,
          series: [], // Clear the data
          legacy: [],
        })
      );
    }

    // Set the loading state immediatly
    this.response.state = LoadingState.Loading;
    this.executor = new Promise<PanelData>((resolve, reject) => {
      this.rejector = reject;

      return ds
        .query(this.request, this.dataStreamObserver)
        .then(resp => {
          this.request.endTime = Date.now();
          this.executor = null;

          // Make sure we send something back -- called run() w/o subscribe!
          if (!(this.sendSeries || this.sendLegacy)) {
            this.sendSeries = true;
          }

          // Save the result state
          this.response = {
            state: LoadingState.Done,
            request: this.request,
            series: this.sendSeries ? getProcessedSeriesData(resp.data) : [],
            legacy: this.sendLegacy ? translateToLegacyData(resp.data) : undefined,
          };
          resolve(this.validateStreamsAndGetPanelData());
        })
        .catch(err => {
          this.executor = null;
          resolve(this.setError(err));
        });
    });

    return this.executor;
  }

  // Send a notice when the stream has updated the current model
  onStreamingDataUpdated: () => void;

  // This gets all stream events and keeps track of them
  // it will then delegate real changes to the PanelQueryRunner
  dataStreamObserver: DataStreamObserver = (stream: DataStreamState) => {
    // Streams only work with the 'series' format
    this.sendSeries = true;

    // Add the stream to our list
    let found = false;
    const active = this.streams.map(s => {
      if (s.key === stream.key) {
        found = true;
        return stream;
      }
      return s;
    });

    if (!found) {
      if (shouldDisconnect(this.request, stream)) {
        console.log('Got stream update from old stream, unsubscribing');
        stream.unsubscribe();
        return;
      }
      active.push(stream);
    }

    this.streams = active;
    this.onStreamingDataUpdated();
  };

  closeStreams(keepSeries = false) {
    if (!this.streams.length) {
      return;
    }

    const series: SeriesData[] = [];

    for (const stream of this.streams) {
      if (stream.series) {
        series.push.apply(series, stream.series);
      }

      try {
        stream.unsubscribe();
      } catch {
        console.log('Failed to unsubscribe to stream');
      }
    }

    this.streams = [];

    // Move the series from streams to the resposne
    if (keepSeries) {
      const { response } = this;
      this.response = {
        ...response,
        series: [
          ...response.series,
          ...series, // Append the streamed series
        ],
      };
    }
  }

  /**
   * This is called before broadcasting data to listeners.  Given that
   * stream events can happen at any point, we need to make sure to
   * only return data from active streams.
   */
  validateStreamsAndGetPanelData(): PanelData {
    const { response, streams, request } = this;

    // When not streaming, return the response + request
    if (!streams.length) {
      return {
        ...response,
        request: request,
      };
    }

    let done = this.isFinished(response.state);
    const series = [...response.series];
    const active: DataStreamState[] = [];

    for (const stream of this.streams) {
      if (shouldDisconnect(request, stream)) {
        console.log('getPanelData() - shouldDisconnect true, unsubscribing to steam');
        stream.unsubscribe();
        continue;
      }

      active.push(stream);
      series.push.apply(series, stream.series);

      if (!this.isFinished(stream.state)) {
        done = false;
      }
    }

    this.streams = active;

    // Update the time range
    let timeRange = this.request.range;
    if (isString(timeRange.raw.from)) {
      timeRange = {
        from: dateMath.parse(timeRange.raw.from, false),
        to: dateMath.parse(timeRange.raw.to, true),
        raw: timeRange.raw,
      };
    }

    return {
      state: done ? LoadingState.Done : LoadingState.Streaming,
      series, // Union of series from response and all streams
      legacy: this.sendLegacy ? translateToLegacyData(series) : undefined,
      request: {
        ...this.request,
        range: timeRange, // update the time range
      },
    };
  }

  /**
   * Make sure all requested formats exist on the data
   */
  getDataAfterCheckingFormats(): PanelData {
    const { response, sendLegacy, sendSeries } = this;
    if (sendLegacy && (!response.legacy || !response.legacy.length)) {
      response.legacy = response.series.map(v => toLegacyResponseData(v));
    }
    if (sendSeries && !response.series.length && response.legacy) {
      response.series = response.legacy.map(v => toSeriesData(v));
    }
    return this.validateStreamsAndGetPanelData();
  }

  setError(err: any): PanelData {
    if (!this.request.endTime) {
      this.request.endTime = Date.now();
    }
    this.closeStreams(true);
    this.response = {
      ...this.response, // Keep any existing data
      state: LoadingState.Error,
      error: toDataQueryError(err),
    };
    return this.validateStreamsAndGetPanelData();
  }
}

export function shouldDisconnect(source: DataQueryRequest, state: DataStreamState) {
  // It came from the same the same request, so keep it
  if (source === state.request || state.request.requestId.startsWith(source.requestId)) {
    return false;
  }

  // We should be able to check that it is the same query regardless of
  // if it came from the same request. This will be important for #16676

  return true;
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

function translateToLegacyData(data: DataQueryResponseData) {
  return data.map(v => {
    if (isSeriesData(v)) {
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

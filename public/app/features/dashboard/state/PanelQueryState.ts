import {
  DataSourceApi,
  DataQueryRequest,
  PanelData,
  LoadingState,
  toLegacyResponseData,
  isSeriesData,
  toSeriesData,
  DataQueryError,
} from '@grafana/ui';
import { getProcessedSeriesData } from './PanelQueryRunner';
import { getBackendSrv } from 'app/core/services/backend_srv';
import isEqual from 'lodash/isEqual';

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

import {
  DataSourceApi,
  DataQueryRequest,
  PanelData,
  LoadingState,
  toLegacyResponseData,
  isSeriesData,
  toSeriesData,
} from '@grafana/ui';
import { getProcessedSeriesData, toDataQueryError } from './PanelQueryRunner';
import { getBackendSrv } from 'app/core/services/backend_srv';
import isEqual from 'lodash/isEqual';

export class PanelQueryState {
  // The current/last running request
  request = {
    startTime: 0,
  } as DataQueryRequest;

  // The best known state of data
  data = {
    state: LoadingState.NotStarted,
    series: [],
  } as PanelData;

  sendSeries = false;
  sendLegacy = false;

  // A promise for the running query
  private executor: Promise<PanelData> = Promise.reject();
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
    if (!request.endTime) {
      this.rejector('Query Canceled:' + reason);
      request.endTime = Date.now();
    }

    // Cancel any open HTTP request with the same ID
    if (request.requestId) {
      getBackendSrv().resolveCancelerIfExists(request.requestId);
    }
  }

  execute(ds: DataSourceApi, req: DataQueryRequest): Promise<PanelData> {
    this.request = req;

    // Return early if there are no queries to run
    if (req.targets.length) {
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

      ds.query(this.request)
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
  checkDataFormats(): PanelData {
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

import { DataQuery, DataQueryResponse, DataSourceApi, DataSourceInstanceSettings } from '@grafana/data';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';
import { Observable, of } from 'rxjs';

export type AlertManagerQuery = {
  query: string;
} & DataQuery;

export class AlertManagerDatasource extends DataSourceApi<AlertManagerQuery> {
  constructor(public instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  // `query()` has to be implemented but we actually don't use it, just need this
  // data source to proxy requests.
  // @ts-ignore
  query(): Observable<DataQueryResponse> {
    return of({
      data: [],
    });
  }

  _request(url: string) {
    const options: BackendSrvRequest = {
      headers: {},
      method: 'GET',
      url: this.instanceSettings.url + url,
    };

    if (this.instanceSettings.basicAuth || this.instanceSettings.withCredentials) {
      this.instanceSettings.withCredentials = true;
    }

    if (this.instanceSettings.basicAuth) {
      options.headers!.Authorization = this.instanceSettings.basicAuth;
    }

    return getBackendSrv().fetch<any>(options).toPromise();
  }

  async testDatasource() {
    let alertmanagerResponse;
    let cortexAlertmanagerResponse;

    try {
      alertmanagerResponse = await this._request('/api/v2/status');
      if (alertmanagerResponse && alertmanagerResponse?.status === 200) {
        return {
          status: 'error',
          message:
            'Only Cortex alert manager implementation is supported. A URL to cortex instance should be provided.',
        };
      }
    } catch (e) {}
    try {
      cortexAlertmanagerResponse = await this._request('/alertmanager/api/v2/status');
    } catch (e) {}

    return cortexAlertmanagerResponse?.status === 200
      ? {
          status: 'success',
          message: 'Health check passed.',
        }
      : {
          status: 'error',
          message: 'Health check failed.',
        };
  }
}

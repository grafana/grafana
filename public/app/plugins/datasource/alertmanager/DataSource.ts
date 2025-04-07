import { lastValueFrom, Observable, of } from 'rxjs';

import { DataQuery, DataQueryResponse, DataSourceApi, DataSourceInstanceSettings } from '@grafana/data';
import { BackendSrvRequest, getBackendSrv, isFetchError } from '@grafana/runtime';

import { discoverAlertmanagerFeaturesByUrl } from '../../../features/alerting/unified/api/buildInfo';
import { messageFromError } from '../../../features/alerting/unified/utils/redux';
import { AlertmanagerApiFeatures } from '../../../types/unified-alerting-dto';

import { AlertManagerDataSourceJsonData, AlertManagerImplementation } from './types';

export type AlertManagerQuery = {
  query: string;
} & DataQuery;

export class AlertManagerDatasource extends DataSourceApi<AlertManagerQuery, AlertManagerDataSourceJsonData> {
  constructor(public instanceSettings: DataSourceInstanceSettings<AlertManagerDataSourceJsonData>) {
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

    return lastValueFrom(getBackendSrv().fetch(options));
  }

  async testDatasource() {
    let alertmanagerResponse;
    const amUrl = this.instanceSettings.url;

    const amFeatures: AlertmanagerApiFeatures = amUrl
      ? await discoverAlertmanagerFeaturesByUrl(amUrl)
      : { lazyConfigInit: false };

    if (this.instanceSettings.jsonData.implementation === AlertManagerImplementation.prometheus) {
      try {
        alertmanagerResponse = await this._request('/alertmanager/api/v2/status');
        if (alertmanagerResponse && alertmanagerResponse?.status === 200) {
          return {
            status: 'error',
            message:
              'It looks like you have chosen Prometheus implementation, but detected a Mimir or Cortex endpoint. Please update implementation selection and try again.',
          };
        }
      } catch (e) {}
      try {
        alertmanagerResponse = await this._request('/api/v2/status');
      } catch (e) {}
    } else {
      try {
        alertmanagerResponse = await this._request('/api/v2/status');
        if (alertmanagerResponse && alertmanagerResponse?.status === 200) {
          return {
            status: 'error',
            message:
              'It looks like you have chosen a Mimir or Cortex implementation, but detected a Prometheus endpoint. Please update implementation selection and try again.',
          };
        }
      } catch (e) {}
      try {
        alertmanagerResponse = await this._request('/alertmanager/api/v2/status');
      } catch (e) {
        if (
          isFetchError(e) &&
          amFeatures.lazyConfigInit &&
          messageFromError(e)?.includes('the Alertmanager is not configured')
        ) {
          return {
            status: 'success',
            message: 'Health check passed.',
            details: { message: 'Mimir Alertmanager without the fallback configuration has been discovered.' },
          };
        }
      }
    }

    return alertmanagerResponse?.status === 200
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

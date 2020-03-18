import appEvents from 'app/core/app_events';
import { CoreEvents } from 'app/types';
import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

import { formatStackdriverError } from './functions';
import { MetricDescriptor } from './types';

export default class Api {
  cache: { [key: string]: Array<SelectableValue<string>> };

  constructor(private baseUrl: string) {
    this.cache = {};
  }

  async resourceCache(
    path: string,
    mapFunc: (res: any) => SelectableValue<string> | MetricDescriptor,
    baseUrl = this.baseUrl
  ): Promise<Array<SelectableValue<string>> | MetricDescriptor[]> {
    try {
      if (this.cache[path]) {
        return this.cache[path];
      }

      const { data } = await this.get(path, 1, baseUrl);
      this.cache[path] = (data[path.match(/([^\/]*)\/*$/)[1]] || []).map(mapFunc);

      return this.cache[path];
    } catch (error) {
      appEvents.emit(CoreEvents.dsRequestError, { error: { data: { error: formatStackdriverError(error) } } });
      return [];
    }
  }

  async get(path: string, maxRetries = 1, baseUrl = this.baseUrl): Promise<any> {
    return getBackendSrv()
      .datasourceRequest({
        url: baseUrl + path,
        method: 'GET',
      })
      .catch((error: any) => {
        if (maxRetries > 0) {
          return this.get(path, maxRetries - 1);
        }

        throw error;
      });
  }

  async post(data: { [key: string]: any }) {
    return getBackendSrv().datasourceRequest({
      url: '/api/tsdb/query',
      method: 'POST',
      data,
    });
  }
}

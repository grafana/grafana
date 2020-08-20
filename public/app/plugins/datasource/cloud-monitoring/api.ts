import appEvents from 'app/core/app_events';
import { CoreEvents } from 'app/types';
import { SelectableValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

import { formatCloudMonitoringError } from './functions';
import { MetricDescriptor } from './types';

interface Options {
  responseMap?: (res: any) => SelectableValue<string> | MetricDescriptor;
  baseUrl?: string;
  useCache?: boolean;
}

export default class Api {
  cache: { [key: string]: Array<SelectableValue<string>> };
  defaultOptions: Options;

  constructor(private baseUrl: string) {
    this.cache = {};
    this.defaultOptions = {
      useCache: true,
      responseMap: (res: any) => res,
      baseUrl: this.baseUrl,
    };
  }

  async get(path: string, options?: Options): Promise<Array<SelectableValue<string>> | MetricDescriptor[]> {
    try {
      const { useCache, responseMap, baseUrl } = { ...this.defaultOptions, ...options };

      if (useCache && this.cache[path]) {
        return this.cache[path];
      }

      const response = await getBackendSrv().datasourceRequest({
        url: baseUrl + path,
        method: 'GET',
      });

      const responsePropName = path.match(/([^\/]*)\/*$/)![1];
      let res = [];
      if (response && response.data && response.data[responsePropName]) {
        res = response.data[responsePropName].map(responseMap);
      }

      if (useCache) {
        this.cache[path] = res;
      }

      return res;
    } catch (error) {
      appEvents.emit(CoreEvents.dsRequestError, { error: { data: { error: formatCloudMonitoringError(error) } } });
      return [];
    }
  }

  async post(data: { [key: string]: any }) {
    return getBackendSrv().datasourceRequest({
      url: '/api/tsdb/query',
      method: 'POST',
      data,
    });
  }

  async test(projectName: string) {
    return getBackendSrv().datasourceRequest({
      url: `${this.baseUrl}${projectName}/metricDescriptors`,
      method: 'GET',
    });
  }
}

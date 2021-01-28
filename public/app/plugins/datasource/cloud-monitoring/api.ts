import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { SelectableValue } from '@grafana/data';
import { FetchResponse, getBackendSrv } from '@grafana/runtime';

import appEvents from 'app/core/app_events';
import { CoreEvents } from 'app/types';
import { formatCloudMonitoringError } from './functions';
import { MetricDescriptor } from './types';

export interface PostResponse {
  results: Record<string, any>;
}

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

  get(path: string, options?: Options): Promise<Array<SelectableValue<string>> | MetricDescriptor[]> {
    const { useCache, responseMap, baseUrl } = { ...this.defaultOptions, ...options };

    if (useCache && this.cache[path]) {
      return Promise.resolve(this.cache[path]);
    }

    return getBackendSrv()
      .fetch<Record<string, any>>({
        url: baseUrl + path,
        method: 'GET',
      })
      .pipe(
        map((response) => {
          const responsePropName = path.match(/([^\/]*)\/*$/)![1];
          let res = [];
          if (response && response.data && response.data[responsePropName]) {
            res = response.data[responsePropName].map(responseMap);
          }

          if (useCache) {
            this.cache[path] = res;
          }

          return res;
        }),
        catchError((error) => {
          appEvents.emit(CoreEvents.dsRequestError, {
            error: { data: { error: formatCloudMonitoringError(error) } },
          });
          return of([]);
        })
      )
      .toPromise();
  }

  post(data: Record<string, any>): Observable<FetchResponse<PostResponse>> {
    return getBackendSrv().fetch<PostResponse>({
      url: '/api/tsdb/query',
      method: 'POST',
      data,
    });
  }

  test(projectName: string) {
    return getBackendSrv()
      .fetch<any>({
        url: `${this.baseUrl}${projectName}/metricDescriptors`,
        method: 'GET',
      })
      .toPromise();
  }
}

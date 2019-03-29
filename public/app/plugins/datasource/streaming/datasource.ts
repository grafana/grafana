import _ from 'lodash';

import { FetchStream } from './method/fetch/FetchStream';
import { RandomWalkStream } from './method/random/RandomWalkStream';
import { StreamHandler } from './StreamHandler';
import { DataQueryOptions, DataQueryResponse, DataSourceApi, SeriesData } from '@grafana/ui';
import { StreamingQuery, StreamingMethod } from './types';
import { FetchQuery } from './method/fetch/types';
import { RandomStreamQuery } from './method/random/types';

/**
 * Return a unique ID based on query properties
 */
export function getQueryKey(query: StreamingQuery): string {
  return query.method;
}

export class StreamingDatasource implements DataSourceApi<StreamingQuery> {
  interval: any;

  supportsExplore = true;
  supportAnnotations = false;
  supportMetrics = true;

  streams = new Map<string, StreamHandler<any>>();

  /** @ngInject */
  constructor(instanceSettings) {
    const safeJsonData = instanceSettings.jsonData || {};
    this.interval = safeJsonData.timeInterval;
  }

  initStreamHandler(query: StreamingQuery, options: DataQueryOptions<StreamingQuery>) {
    if (query.method === StreamingMethod.fetch) {
      return new FetchStream(query as FetchQuery, options, this);
    }
    if (query.method === StreamingMethod.random) {
      return new RandomWalkStream(query as RandomStreamQuery, options, this);
    }

    throw new Error('Unsupported method: ' + query.method);
  }

  query(options: DataQueryOptions<StreamingQuery>): Promise<DataQueryResponse> {
    const { targets } = options;
    if (!targets || targets.length < 1) {
      return Promise.resolve({ data: [] });
    }

    return new Promise((resolve, reject) => {
      const { streams } = this;
      const series: SeriesData[] = [];
      for (const query of targets) {
        if (query.hide) {
          continue;
        }

        // Make sure it has a valid method
        if (!query.method) {
          query.method = StreamingMethod.random;
        }

        const key = getQueryKey(query);
        if (!streams.has(key)) {
          streams.set(key, this.initStreamHandler(query, options));
          console.log('MAKE Stream', key);
        }
        series.push(streams.get(key).series);
      }
      resolve({ data: series });
    });
  }

  metricFindQuery(query: string, options?: any) {
    console.log('TODO metricFindQuery', query, options);
    return Promise.resolve({ data: [] });
  }

  testDatasource() {
    return new Promise((resolve, reject) => {
      resolve({
        status: 'success',
        message: 'yes!',
      });
    });
  }
}

export default StreamingDatasource;

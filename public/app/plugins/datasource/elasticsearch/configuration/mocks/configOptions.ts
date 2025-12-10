import { DataSourceSettings } from '@grafana/data';

import { ElasticsearchOptions } from '../../types';

export function createDefaultConfigOptions(): DataSourceSettings<ElasticsearchOptions> {
  return {
    jsonData: {
      timeField: '@time',
      interval: 'Hourly',
      timeInterval: '10s',
      maxConcurrentShardRequests: 300,
      logMessageField: 'test.message',
      logLevelField: 'test.level',
      defaultQueryMode: 'metrics',
    },
    secureJsonFields: {},
  } as DataSourceSettings<ElasticsearchOptions>;
}

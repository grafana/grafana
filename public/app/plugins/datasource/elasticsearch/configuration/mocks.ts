import { DataSourceSettings } from '@grafana/data';

import { createDatasourceSettings } from '../../../../features/datasources/mocks';
import { ElasticsearchOptions } from '../types';

export function createDefaultConfigOptions(
  options?: Partial<ElasticsearchOptions>
): DataSourceSettings<ElasticsearchOptions> {
  return createDatasourceSettings<ElasticsearchOptions>({
    timeField: '@time',
    esVersion: '7.0.0',
    interval: 'Hourly',
    timeInterval: '10s',
    maxConcurrentShardRequests: 300,
    logMessageField: 'test.message',
    logLevelField: 'test.level',
    ...options,
  });
}

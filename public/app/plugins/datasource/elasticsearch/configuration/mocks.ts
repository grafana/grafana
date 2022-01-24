import { DataSourceSettings } from '@grafana/data';
import { ElasticsearchOptions } from '../types';
import { createDatasourceSettings } from '../../../../features/datasources/mocks';

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

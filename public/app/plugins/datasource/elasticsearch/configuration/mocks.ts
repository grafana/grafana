import { DataSourceSettings } from '@grafana/data';
import { ElasticsearchOptions } from '../types';
import { createDatasourceSettings } from '../../../../features/datasources/mocks';

export function createDefaultConfigOptions(): DataSourceSettings<ElasticsearchOptions> {
  return createDatasourceSettings<ElasticsearchOptions>({
    timeField: '@time',
    esVersion: 70,
    interval: 'Hourly',
    timeInterval: '10s',
    maxConcurrentShardRequests: 300,
    logMessageField: 'test.message',
    logLevelField: 'test.level',
  });
}

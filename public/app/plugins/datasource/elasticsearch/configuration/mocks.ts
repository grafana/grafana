import { DataSourceSettings } from '@grafana/ui';
import { ElasticsearchOptions } from '../types';

export function createDefaultConfigOptions(): DataSourceSettings<ElasticsearchOptions> {
  return {
    id: 0,
    orgId: 0,
    name: 'elastic-test',
    typeLogoUrl: '',
    type: 'datasource',
    access: 'server',
    url: 'http://localhost',
    password: '',
    user: '',
    database: '',
    basicAuth: false,
    basicAuthPassword: '',
    basicAuthUser: '',
    isDefault: false,
    jsonData: {
      timeField: '@time',
      esVersion: 70,
      interval: 'Hourly',
      timeInterval: '10s',
      maxConcurrentShardRequests: 300,
      logMessageField: 'test.message',
      logLevelField: 'test.level',
    },
    readOnly: false,
    withCredentials: false,
  };
}

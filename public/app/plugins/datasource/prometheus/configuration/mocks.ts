import { DataSourceSettings } from '@grafana/data';

import { getMockDataSource } from '../../../../features/datasources/__mocks__';
import { PromOptions } from '../types';

export function createDefaultConfigOptions(): DataSourceSettings<PromOptions> {
  return getMockDataSource<PromOptions>({
    jsonData: {
      timeInterval: '1m',
      queryTimeout: '1m',
      httpMethod: 'GET',
      directUrl: 'url',
    },
  });
}

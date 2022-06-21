import { DataSourceSettings } from '@grafana/data';

import { createDatasourceSettings } from '../../../../features/datasources/mocks';
import { PromOptions } from '../types';

export function createDefaultConfigOptions(): DataSourceSettings<PromOptions> {
  return createDatasourceSettings<PromOptions>({
    timeInterval: '1m',
    queryTimeout: '1m',
    httpMethod: 'GET',
    directUrl: 'url',
  });
}

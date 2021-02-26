import { DataSourceSettings } from '@grafana/data';
import { PromOptions } from '../types';
import { createDatasourceSettings } from '../../../../features/datasources/mocks';
import { PrometheusFlavour } from '../flavour_provider';

export function createDefaultConfigOptions(): DataSourceSettings<PromOptions> {
  return createDatasourceSettings<PromOptions>({
    timeInterval: '1m',
    queryTimeout: '1m',
    httpMethod: 'GET',
    directUrl: 'url',
    flavour: PrometheusFlavour.Prometheus,
    retentionPolicies: '',
  });
}

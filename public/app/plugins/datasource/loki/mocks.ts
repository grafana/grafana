import LokiDatasource from './datasource';
import { DataSourceSettings } from '@grafana/data';
import { LokiOptions } from './types';
import { createDatasourceSettings } from '../../../features/datasources/mocks';

export function makeMockLokiDatasource(labelsAndValues: { [label: string]: string[] }): LokiDatasource {
  const labels = Object.keys(labelsAndValues);
  return {
    metadataRequest: (url: string) => {
      let responseData;
      if (url === '/api/prom/label') {
        responseData = labels;
      } else {
        const match = url.match(/^\/api\/prom\/label\/(\w*)\/values/);
        if (match) {
          responseData = labelsAndValues[match[1]];
        }
      }
      if (responseData) {
        return {
          data: {
            data: responseData,
          },
        };
      } else {
        throw new Error(`Unexpected url error, ${url}`);
      }
    },
  } as any;
}

export function createDefaultConfigOptions(): DataSourceSettings<LokiOptions> {
  return createDatasourceSettings<LokiOptions>({
    maxLines: '531',
  });
}

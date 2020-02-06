import { LokiDatasource, LOKI_ENDPOINT, LEGACY_LOKI_ENDPOINT } from './datasource';
import { DataSourceSettings } from '@grafana/data';
import { LokiOptions } from './types';
import { createDatasourceSettings } from '../../../features/datasources/mocks';

export function makeMockLokiDatasource(labelsAndValues: { [label: string]: string[] }): LokiDatasource {
  const legacyLokiLabelsAndValuesEndpointRegex = /^\/api\/prom\/label\/(\w*)\/values/;
  const lokiLabelsAndValuesEndpointRegex = /^\/loki\/api\/v1\/label\/(\w*)\/values/;

  const legacyLokiLabelsEndpoint = `${LEGACY_LOKI_ENDPOINT}/label`;
  const lokiLabelsEndpoint = `${LOKI_ENDPOINT}/label`;

  const labels = Object.keys(labelsAndValues);
  return {
    metadataRequest: (url: string) => {
      let responseData;
      if (url === legacyLokiLabelsEndpoint || url === lokiLabelsEndpoint) {
        responseData = labels;
      } else {
        const match = url.match(legacyLokiLabelsAndValuesEndpointRegex) || url.match(lokiLabelsAndValuesEndpointRegex);
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

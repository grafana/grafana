import { LokiDatasource, LOKI_ENDPOINT, LEGACY_LOKI_ENDPOINT } from './datasource';
import { DataSourceSettings } from '@grafana/data';
import { LokiOptions } from './types';
import { createDatasourceSettings } from '../../../features/datasources/mocks';

interface Labels {
  [label: string]: string[];
}

interface Series {
  [label: string]: string;
}

interface SeriesForSelector {
  [selector: string]: Series[];
}

export function makeMockLokiDatasource(labelsAndValues: Labels, series?: SeriesForSelector): LokiDatasource {
  const legacyLokiLabelsAndValuesEndpointRegex = /^\/api\/prom\/label\/(\w*)\/values/;
  const lokiLabelsAndValuesEndpointRegex = /^\/loki\/api\/v1\/label\/(\w*)\/values/;
  const lokiSeriesEndpointRegex = /^\/loki\/api\/v1\/series/;

  const legacyLokiLabelsEndpoint = `${LEGACY_LOKI_ENDPOINT}/label`;
  const lokiLabelsEndpoint = `${LOKI_ENDPOINT}/label`;

  const labels = Object.keys(labelsAndValues);
  return {
    metadataRequest: (url: string, params?: { [key: string]: string }) => {
      if (url === legacyLokiLabelsEndpoint || url === lokiLabelsEndpoint) {
        return labels;
      } else {
        const legacyLabelsMatch = url.match(legacyLokiLabelsAndValuesEndpointRegex);
        const labelsMatch = url.match(lokiLabelsAndValuesEndpointRegex);
        const seriesMatch = url.match(lokiSeriesEndpointRegex);
        if (legacyLabelsMatch) {
          return labelsAndValues[legacyLabelsMatch[1]] || [];
        } else if (labelsMatch) {
          return labelsAndValues[labelsMatch[1]] || [];
        } else if (seriesMatch) {
          return series[params.match] || [];
        } else {
          throw new Error(`Unexpected url error, ${url}`);
        }
      }
    },
  } as any;
}

export function createDefaultConfigOptions(): DataSourceSettings<LokiOptions> {
  return createDatasourceSettings<LokiOptions>({
    maxLines: '531',
  });
}

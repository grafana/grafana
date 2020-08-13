import { LokiDatasource, LOKI_ENDPOINT } from './datasource';
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
  const lokiLabelsAndValuesEndpointRegex = /^\/loki\/api\/v1\/label\/(\w*)\/values/;
  const lokiSeriesEndpointRegex = /^\/loki\/api\/v1\/series/;

  const lokiLabelsEndpoint = `${LOKI_ENDPOINT}/label`;

  const labels = Object.keys(labelsAndValues);
  return {
    metadataRequest: (url: string, params?: { [key: string]: string }) => {
      if (url === lokiLabelsEndpoint) {
        //To test custom time ranges
        if (Number(params?.start) === 2000000) {
          return [labels[0]];
        }
        return labels;
      } else {
        const labelsMatch = url.match(lokiLabelsAndValuesEndpointRegex);
        const seriesMatch = url.match(lokiSeriesEndpointRegex);
        if (labelsMatch) {
          return labelsAndValues[labelsMatch[1]] || [];
        } else if (seriesMatch && series && params) {
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

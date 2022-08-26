import { DataSourceInstanceSettings, DataSourceSettings, PluginType, toUtc } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

import { getMockDataSource } from '../../../features/datasources/__mocks__';

import { LokiDatasource } from './datasource';
import { LokiOptions } from './types';

export function createDefaultConfigOptions(): DataSourceSettings<LokiOptions> {
  return getMockDataSource<LokiOptions>({
    jsonData: { maxLines: '531' },
  });
}

const rawRange = {
  from: toUtc('2018-04-25 10:00'),
  to: toUtc('2018-04-25 11:00'),
};

const defaultTimeSrvMock = {
  timeRange: () => ({
    from: rawRange.from,
    to: rawRange.to,
    raw: rawRange,
  }),
};

export function createLokiDatasource(
  templateSrvMock: TemplateSrv,
  settings: Partial<DataSourceInstanceSettings<LokiOptions>> = {},
  timeSrvStub = defaultTimeSrvMock
): LokiDatasource {
  const customSettings: DataSourceInstanceSettings<LokiOptions> = {
    url: 'myloggingurl',
    id: 0,
    uid: '',
    type: '',
    name: '',
    meta: {
      id: 'id',
      name: 'name',
      type: PluginType.datasource,
      module: '',
      baseUrl: '',
      info: {
        author: {
          name: 'Test',
        },
        description: '',
        links: [],
        logos: {
          large: '',
          small: '',
        },
        screenshots: [],
        updated: '',
        version: '',
      },
    },
    jsonData: {
      maxLines: '20',
    },
    access: 'direct',
    ...settings,
  };

  // @ts-expect-error
  return new LokiDatasource(customSettings, templateSrvMock, timeSrvStub);
}

export function createMetadataRequest(
  labelsAndValues: Record<string, string[]>,
  series?: Record<string, Array<Record<string, string>>>
) {
  // added % to allow urlencoded labelKeys. Note, that this is not confirm with Loki, as loki does not allow specialcharacters in labelKeys, but needed for tests.
  const lokiLabelsAndValuesEndpointRegex = /^label\/([%\w]*)\/values/;
  const lokiSeriesEndpointRegex = /^series/;
  const lokiLabelsEndpoint = 'labels';
  const labels = Object.keys(labelsAndValues);

  return async function metadataRequestMock(url: string, params?: Record<string, string | number>) {
    if (url === lokiLabelsEndpoint) {
      return labels;
    } else {
      const labelsMatch = url.match(lokiLabelsAndValuesEndpointRegex);
      const seriesMatch = url.match(lokiSeriesEndpointRegex);
      if (labelsMatch) {
        return labelsAndValues[labelsMatch[1]] || [];
      } else if (seriesMatch && series && params) {
        return series[params['match[]']] || [];
      } else {
        throw new Error(`Unexpected url error, ${url}`);
      }
    }
  };
}

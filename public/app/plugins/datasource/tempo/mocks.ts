import { DataSourceInstanceSettings, PluginType, toUtc } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

import { TempoDatasource } from './datasource';
import { TempoJsonData } from './types';

const rawRange = {
  from: toUtc('2018-04-25 10:00'),
  to: toUtc('2018-04-25 11:00'),
};

const defaultTimeSrvMock = {
  timeRange: jest.fn().mockReturnValue({
    from: rawRange.from,
    to: rawRange.to,
    raw: rawRange,
  }),
};

const defaultTemplateSrvMock = {
  replace: (input: string) => input,
};

export function createTempoDatasource(
  templateSrvMock: Partial<TemplateSrv> = defaultTemplateSrvMock,
  settings: Partial<DataSourceInstanceSettings<TempoJsonData>> = {},
  timeSrvStub = defaultTimeSrvMock
): TempoDatasource {
  const customSettings: DataSourceInstanceSettings<TempoJsonData> = {
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
    readOnly: false,
    jsonData: {},
    access: 'direct',
    ...settings,
  };

  // @ts-expect-error
  return new TempoDatasource(customSettings, templateSrvMock, timeSrvStub);
}

export function createMetadataRequest(labelsAndValues: Record<string, Record<string, string[]>>) {
  return async () => labelsAndValues;
}

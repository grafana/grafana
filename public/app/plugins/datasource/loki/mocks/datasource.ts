import { DataSourceInstanceSettings, DataSourceSettings, PluginType } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

import { LokiDatasource } from '../datasource';
import { LokiOptions } from '../types';

export function createDefaultConfigOptions() {
  return {
    jsonData: { maxLines: '531' },
    secureJsonFields: {},
  } as DataSourceSettings<LokiOptions>;
}

const defaultTemplateSrvMock = {
  replace: (input: string) => input,
  getVariables: () => [],
};

export function createLokiDatasource(
  templateSrvMock: Partial<TemplateSrv> = defaultTemplateSrvMock,
  settings: Partial<DataSourceInstanceSettings<LokiOptions>> = {}
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
    readOnly: false,
    jsonData: {
      maxLines: '20',
    },
    access: 'direct',
    ...settings,
  };

  return new LokiDatasource(customSettings, templateSrvMock as TemplateSrv);
}

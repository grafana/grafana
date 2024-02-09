import { DataSourceInstanceSettings, PluginType } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

import { ElasticDatasource } from './datasource';
import { ElasticsearchOptions } from './types';

export function createElasticDatasource(settings: Partial<DataSourceInstanceSettings<ElasticsearchOptions>> = {}) {
  const { jsonData, ...rest } = settings;

  const instanceSettings: DataSourceInstanceSettings<ElasticsearchOptions> = {
    id: 1,
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
    name: 'test-elastic',
    type: 'type',
    uid: 'uid',
    access: 'proxy',
    url: '',
    jsonData: {
      timeField: '',
      timeInterval: '',
      index: '[test-]YYYY.MM.DD',
      ...jsonData,
    },
    ...rest,
  };

  const templateSrv: TemplateSrv = {
    getVariables: () => [],
    replace: (text?: string) => {
      if (text?.startsWith('$')) {
        return `resolvedVariable`;
      } else {
        return text || '';
      }
    },
    containsTemplate: (text?: string) => text?.includes('$') ?? false,
    updateTimeRange: () => {},
  };

  return new ElasticDatasource(instanceSettings, templateSrv);
}

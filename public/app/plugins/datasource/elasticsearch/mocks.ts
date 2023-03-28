import { DataSourceInstanceSettings, PluginType } from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { ElasticDatasource } from './datasource';
import { ElasticsearchOptions } from './types';

export function createElasticDatasource(
  settings: Partial<DataSourceInstanceSettings<ElasticsearchOptions>> = {},
  templateSrv: TemplateSrv
) {
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
      ...jsonData,
    },
    database: '[test-]YYYY.MM.DD',
    ...rest,
  };

  return new ElasticDatasource(instanceSettings, templateSrv);
}

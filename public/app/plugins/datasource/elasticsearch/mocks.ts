import { CoreApp, DataQueryRequest, DataSourceInstanceSettings, FieldType, PluginType, dateTime } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

import { ElasticsearchDataQuery } from './dataquery.gen';
import { ElasticDatasource } from './datasource';
import { ElasticsearchOptions } from './types';

export function createElasticDatasource(
  settings: Partial<DataSourceInstanceSettings<Partial<ElasticsearchOptions>>> = {}
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
    url: 'http://elasticsearch.local',
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

export const createElasticQuery = (): DataQueryRequest<ElasticsearchDataQuery> => {
  return {
    requestId: '',
    interval: '',
    panelId: 0,
    intervalMs: 1,
    scopedVars: {},
    timezone: '',
    app: CoreApp.Dashboard,
    startTime: 0,
    range: {
      from: dateTime([2015, 4, 30, 10]),
      to: dateTime([2015, 5, 1, 10]),
      raw: {
        from: '',
        to: '',
      },
    },
    targets: [
      {
        refId: 'A',
        bucketAggs: [{ type: 'date_histogram', field: '@timestamp', id: '2' }],
        metrics: [{ type: 'count', id: '' }],
        query: 'test',
      },
    ],
  };
};

export const mockResponseFrames = [
  {
    schema: {
      fields: [
        { name: '@timestamp', type: FieldType.time },
        { name: 'Value', type: FieldType.number },
      ],
    },
    data: {
      values: [
        [100, 200, 300],
        [1, 2, 3],
      ],
    },
  },
];

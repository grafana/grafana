import {
  AdHocVariableFilter,
  CoreApp,
  DataQueryRequest,
  DataSourceInstanceSettings,
  FieldType,
  PluginType,
  dateTime,
} from '@grafana/data';
import { TemplateSrv as BaseTemplateSrv } from '@grafana/runtime';
import type { TemplateSrv } from 'app/features/templating/template_srv';

import { ElasticDatasource } from './datasource';
import { ElasticsearchOptions, ElasticsearchQuery } from './types';

export function createElasticDatasource(
  settings: Partial<DataSourceInstanceSettings<Partial<ElasticsearchOptions>>> & {
    getAdhocFilters?: (dsName: string, ignoreWarnings?: boolean) => AdHocVariableFilter[];
  } = {}
) {
  const { jsonData, getAdhocFilters = (dsName: string) => [], ...rest } = settings;

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

  const templateSrv: BaseTemplateSrv & Pick<TemplateSrv, 'getAdhocFilters'> = {
    getVariables: () => [],
    getAdhocFilters,
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

export const createElasticQuery = (): DataQueryRequest<ElasticsearchQuery> => {
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

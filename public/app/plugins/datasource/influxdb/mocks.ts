import { of } from 'rxjs';

import {
  AdHocVariableFilter,
  DataQueryRequest,
  DataSourceInstanceSettings,
  dateTime,
  FieldType,
  PluginType,
  ScopedVars,
} from '@grafana/data/src';
import {
  BackendDataSourceResponse,
  FetchResponse,
  getBackendSrv,
  setBackendSrv,
  VariableInterpolation,
} from '@grafana/runtime/src';

import { TemplateSrv } from '../../../features/templating/template_srv';

import InfluxDatasource from './datasource';
import { InfluxOptions, InfluxQuery, InfluxVersion } from './types';

const getAdhocFiltersMock = jest.fn().mockImplementation(() => []);
const replaceMock = jest.fn().mockImplementation((a: string, ...rest: unknown[]) => a);

export const templateSrvStub = {
  getAdhocFilters: getAdhocFiltersMock,
  replace: replaceMock,
} as unknown as TemplateSrv;

export function mockTemplateSrv(
  getAdhocFiltersMock: (datasourceName: string) => AdHocVariableFilter[],
  replaceMock: (
    target?: string,
    scopedVars?: ScopedVars,
    format?: string | Function | undefined,
    interpolations?: VariableInterpolation[]
  ) => string
): TemplateSrv {
  return {
    getAdhocFilters: getAdhocFiltersMock,
    replace: replaceMock,
  } as unknown as TemplateSrv;
}

export function mockBackendService(response: FetchResponse) {
  const fetchMock = jest.fn().mockReturnValue(of(response));
  const origBackendSrv = getBackendSrv();
  setBackendSrv({
    ...origBackendSrv,
    fetch: fetchMock,
  });
  return fetchMock;
}

export function getMockInfluxDS(
  instanceSettings: DataSourceInstanceSettings<InfluxOptions> = getMockDSInstanceSettings(),
  templateSrv: TemplateSrv = templateSrvStub
): InfluxDatasource {
  return new InfluxDatasource(instanceSettings, templateSrv);
}

export function getMockDSInstanceSettings(
  overrideJsonData?: Partial<InfluxOptions>
): DataSourceInstanceSettings<InfluxOptions> {
  return {
    id: 123,
    url: 'proxied',
    access: 'proxy',
    name: 'influxDb',
    readOnly: false,
    uid: 'influxdb-test',
    type: 'influxdb',
    meta: {
      id: 'influxdb-meta',
      type: PluginType.datasource,
      name: 'influxdb-test',
      info: {
        author: {
          name: 'observability-metrics',
        },
        version: 'v0.0.1',
        description: 'test',
        links: [],
        logos: {
          large: '',
          small: '',
        },
        updated: '',
        screenshots: [],
      },
      module: '',
      baseUrl: '',
    },
    jsonData: {
      version: InfluxVersion.InfluxQL,
      httpMode: 'POST',
      dbName: 'site',
      ...(overrideJsonData ? overrideJsonData : {}),
    },
  };
}

export const mockInfluxFetchResponse = (
  overrides?: Partial<FetchResponse<BackendDataSourceResponse>>
): FetchResponse<BackendDataSourceResponse> => {
  return {
    config: {
      url: 'mock-response-url',
    },
    headers: new Headers(),
    ok: false,
    redirected: false,
    status: 0,
    statusText: '',
    type: 'basic',
    url: '',
    data: {
      results: {
        A: {
          status: 200,
          frames: mockInfluxTSDBQueryResponse,
        },
        metadataQuery: {
          status: 200,
          frames: mockInfluxRetentionPolicyResponse,
        },
      },
    },
    ...overrides,
  };
};
export const mockInfluxTSDBQueryResponse = [
  {
    schema: {
      name: 'logs.host',
      fields: [
        {
          name: 'time',
          type: FieldType.time,
        },
        {
          name: 'value',
          type: FieldType.string,
        },
      ],
    },
    data: {
      values: [
        [1645208701000, 1645208702000],
        ['cbfa07e0e3bb 1', 'cbfa07e0e3bb 2'],
      ],
    },
  },
  {
    schema: {
      name: 'logs.message',
      fields: [
        {
          name: 'time',
          type: FieldType.time,
        },
        {
          name: 'value',
          type: FieldType.string,
        },
      ],
    },
    data: {
      values: [
        [1645208701000, 1645208702000],
        ['Station softwareupdated[447]: Adding client 1', 'Station softwareupdated[447]: Adding client 2'],
      ],
    },
  },
  {
    schema: {
      name: 'logs.path',
      fields: [
        {
          name: 'time',
          type: FieldType.time,
        },
        {
          name: 'value',
          type: FieldType.string,
        },
      ],
    },
    data: {
      values: [
        [1645208701000, 1645208702000],
        ['/var/log/host/install.log 1', '/var/log/host/install.log 2'],
      ],
    },
  },
  {
    schema: {
      name: 'textColumn',
      fields: [
        {
          name: 'time',
          type: FieldType.time,
        },
        {
          name: 'value',
          type: FieldType.string,
        },
      ],
    },
    data: {
      values: [
        [1645208701000, 1645208702000],
        ['text 1', 'text 2'],
      ],
    },
  },
];

export const mockInfluxRetentionPolicyResponse = [
  {
    schema: {
      refId: 'metadataQuery',
      fields: [{ name: 'value', type: FieldType.string, typeInfo: { frame: 'string' } }],
    },
    data: { values: [['autogen', 'bar', '5m_avg', '1m_avg', 'default']] },
  },
];

export const mockInfluxQueryRequest = (targets?: InfluxQuery[]): DataQueryRequest<InfluxQuery> => {
  return {
    app: 'explore',
    interval: '1m',
    intervalMs: 60000,
    range: {
      from: dateTime(0),
      to: dateTime(10),
      raw: { from: dateTime(0), to: dateTime(10) },
    },
    rangeRaw: {
      from: dateTime(0),
      to: dateTime(10),
    },
    requestId: '',
    scopedVars: {},
    startTime: 0,
    targets: targets ?? mockTargets(),
    timezone: '',
  };
};

export const mockTargets = (): InfluxQuery[] => {
  return [
    {
      refId: 'A',
      datasource: {
        type: 'influxdb',
        uid: 'vA4bkHenk',
      },
      policy: 'default',
      resultFormat: 'time_series',
      orderByTime: 'ASC',
      tags: [],
      groupBy: [
        {
          type: 'time',
          params: ['$__interval'],
        },
        {
          type: 'fill',
          params: ['null'],
        },
      ],
      select: [
        [
          {
            type: 'field',
            params: ['value'],
          },
          {
            type: 'mean',
            params: [],
          },
        ],
      ],
      measurement: 'cpu',
    },
  ];
};

export const mockInfluxQueryWithTemplateVars = (adhocFilters: AdHocVariableFilter[]): InfluxQuery => ({
  refId: 'x',
  alias: '$interpolationVar',
  measurement: '$interpolationVar',
  policy: '$interpolationVar',
  limit: '$interpolationVar',
  slimit: '$interpolationVar',
  tz: '$interpolationVar',
  tags: [
    {
      key: 'cpu',
      operator: '=~',
      value: '/^$interpolationVar,$interpolationVar2$/',
    },
  ],
  groupBy: [
    {
      params: ['$interpolationVar'],
      type: 'tag',
    },
  ],
  select: [
    [
      {
        params: ['$interpolationVar'],
        type: 'field',
      },
    ],
  ],
  adhocFilters,
});

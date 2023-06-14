import { DataQueryRequest, dateTime, FieldType } from '@grafana/data/src';
import { BackendDataSourceResponse, FetchResponse } from '@grafana/runtime/src';

import { TemplateSrv } from '../../../../features/templating/template_srv';
import { InfluxQuery } from '../types';

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

export const mockInfluxDataRequest = (
  targets: InfluxQuery[],
  overrides?: Partial<DataQueryRequest>
): Partial<DataQueryRequest<InfluxQuery>> => {
  const defaults: DataQueryRequest<InfluxQuery> = {
    app: 'createDataRequest',
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
    targets: targets,
    timezone: '',
  };
  return Object.assign(defaults, overrides ?? {});
};

export const mockInfluxTemplateSrv: Partial<TemplateSrv> = {
  getAdhocFilters: jest.fn().mockImplementation(() => []),
  replace: jest.fn().mockImplementation((a: string, ...rest: unknown[]) => a),
};

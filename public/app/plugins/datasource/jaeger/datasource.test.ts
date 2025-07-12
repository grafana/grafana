import { lastValueFrom, of } from 'rxjs';

import {
  DataQueryRequest,
  DataSourceInstanceSettings,
  dateTime,
  FieldType,
  PluginMetaInfo,
  PluginType,
  ScopedVars,
} from '@grafana/data';
import { BackendSrv, DataSourceWithBackend } from '@grafana/runtime';

import { JaegerDatasource, JaegerJsonData } from './datasource';
import mockJson from './mockJsonResponse.json';
import mockSearchResponse from './mockSearchResponse.json';
import mockTraceResponse from './mockTraceResponse.json';
import { JaegerQuery } from './types';

export const backendSrv = { fetch: jest.fn() } as unknown as BackendSrv;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
  getTemplateSrv: () => ({
    replace: (val: string, subs: ScopedVars): string => {
      return subs[val]?.value ?? val;
    },
    containsTemplate: (val: string): boolean => {
      return val.includes('$');
    },
  }),
}));

describe('upload, search and trace query types', () => {
  it('should process valid JSON file uploads', async () => {
    const ds = new JaegerDatasource(defaultSettings);
    ds.uploadedJson = JSON.stringify(mockJson);
    const response = await lastValueFrom(ds.query({ ...defaultQuery, targets: [{ queryType: 'upload', refId: 'A' }] }));
    const field = response.data[0].fields[0];
    expect(field.name).toBe('traceID');
    expect(field.type).toBe(FieldType.string);
    expect(field.values.length).toBe(2);
  });

  it('should reject invalid JSON file uploads', async () => {
    const ds = new JaegerDatasource(defaultSettings);
    ds.uploadedJson = JSON.stringify({ key: 'value', arr: [] });
    const response = await lastValueFrom(
      ds.query({ targets: [{ queryType: 'upload', refId: 'A' }] } as DataQueryRequest<JaegerQuery>)
    );
    expect(response.error?.message).toBe('The JSON file uploaded is not in a valid Jaeger format');
    expect(response.data.length).toBe(0);
  });

  it('should return search results when query type is search', async () => {
    setupQueryMock('search');
    const ds = new JaegerDatasource(defaultSettings);
    const response = await lastValueFrom(
      ds.query({
        ...defaultQuery,
        targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', operation: '/api/services' }],
      })
    );

    expect(response.data[0].meta.preferredVisualisationType).toBe('table');
    expect(response.data[0].fields[0].config.links).toHaveLength(1);
    expect(response.data[0].fields[0].name).toBe('traceID');
  });

  it('should return trace results when query type is trace', async () => {
    setupQueryMock('trace');
    const ds = new JaegerDatasource(defaultSettings);
    const response = await lastValueFrom(
      ds.query({ ...defaultQuery, targets: [{ queryType: undefined, refId: 'a', query: '12345' }] })
    );

    expect(response.data[0].meta.preferredVisualisationType).toBe('trace');
    expect(response.data[0].fields.length).toBe(7);
  });
});

describe('node graph functionality', () => {
  it('should include node graph frames when nodeGraph is enabled for trace queries', async () => {
    const settingsWithNodeGraph = {
      ...defaultSettings,
      jsonData: {
        ...defaultSettings.jsonData,
        nodeGraph: { enabled: true },
      },
    };

    const ds = new JaegerDatasource(settingsWithNodeGraph);
    setupQueryMock('trace');

    const response = await lastValueFrom(
      ds.query({
        ...defaultQuery,
        targets: [
          {
            query: '12345',
            refId: '1',
          },
        ],
      })
    );

    expect(response.data.length).toBe(3);
  });

  it('should exclude node graph frames when nodeGraph is disabled for trace queries', async () => {
    const settingsWithoutNodeGraph = {
      ...defaultSettings,
      jsonData: {
        ...defaultSettings.jsonData,
        nodeGraph: { enabled: false },
      },
    };

    const ds = new JaegerDatasource(settingsWithoutNodeGraph);
    setupQueryMock('trace');

    const response = await lastValueFrom(
      ds.query({
        ...defaultQuery,
        targets: [
          {
            query: '12345',
            refId: '1',
          },
        ],
      })
    );

    expect(response.data.length).toBe(1);
  });
});

describe('time range', () => {
  it('should calculate correct time range', async () => {
    const ds = new JaegerDatasource(defaultSettings);
    const timeRange = ds.getTimeRange();
    const now = Date.now();
    expect(timeRange.end).toBeCloseTo(now * 1000, -4);
    expect(timeRange.start).toBeCloseTo((now - 6 * 3600 * 1000) * 1000, -4);
  });
});

function setupQueryMock(type: 'trace' | 'search') {
  return jest.spyOn(DataSourceWithBackend.prototype, 'query').mockImplementation(() => {
    if (type === 'search') {
      return of(mockSearchResponse);
    } else {
      return of(mockTraceResponse);
    }
  });
}

const defaultSettings: DataSourceInstanceSettings<JaegerJsonData> = {
  id: 0,
  uid: '0',
  type: 'tracing',
  name: 'jaeger',
  url: 'http://grafana.com',
  access: 'proxy',
  meta: {
    id: 'jaeger',
    name: 'jaeger',
    type: PluginType.datasource,
    info: {} as PluginMetaInfo,
    module: '',
    baseUrl: '',
  },
  jsonData: {
    nodeGraph: {
      enabled: true,
    },
  },
  readOnly: false,
};

const defaultQuery: DataQueryRequest<JaegerQuery> = {
  requestId: '1',
  interval: '0',
  intervalMs: 10,
  panelId: 0,
  scopedVars: {},
  range: {
    from: dateTime().subtract(1, 'h'),
    to: dateTime(),
    raw: { from: '1h', to: 'now' },
  },
  timezone: 'browser',
  app: 'explore',
  startTime: 0,
  targets: [
    {
      query: '12345',
      refId: '1',
    },
  ],
};

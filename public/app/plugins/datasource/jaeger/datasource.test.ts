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
import { testResponseDataFrameFields, testResponseEdgesFields, testResponseNodesFields } from './testResponse';
import { JaegerQuery } from './types';
import mockSearchResponse from './mockSearchResponse.json';
import mockTraceResponse from './mockTraceResponse.json';

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

describe('JaegerDatasource', () => {
  it.skip('should return trace, nodes, and edges when querying by trace ID', async () => {
    setupQueryMock('trace');

    const ds = new JaegerDatasource(defaultSettings);
    const response = await lastValueFrom(ds.query(defaultQuery));
    expect(response.data.length).toBe(3);
    expect(response.data[0].fields).toMatchObject(testResponseDataFrameFields);
    expect(response.data[1].fields).toMatchObject(testResponseNodesFields);
    expect(response.data[2].fields).toMatchObject(testResponseEdgesFields);
  });

  it('should handle trace IDs with special characters', async () => {
    const mock = setupQueryMock('trace');

    const ds = new JaegerDatasource(defaultSettings);
    const query = {
      ...defaultQuery,
      targets: [
        {
          query: 'a/b',
          refId: '1',
        },
      ],
    };
    await lastValueFrom(ds.query(query));
    expect(mock).toHaveBeenCalledWith(expect.objectContaining({ targets: [{ query: 'a/b', refId: '1' }] }));
  });

  it('should return empty trace response when no trace ID is provided', async () => {
    const ds = new JaegerDatasource(defaultSettings);
    const response = await lastValueFrom(ds.query({ ...defaultQuery, targets: [] }));
    const field = response.data[0].fields[0];
    expect(field.name).toBe('trace');
    expect(field.type).toBe(FieldType.trace);
    expect(field.values.length).toBe(0);
  });

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
    const mock = setupQueryMock('search');
    const ds = new JaegerDatasource(defaultSettings);
    const response = await lastValueFrom(
      ds.query({
        ...defaultQuery,
        targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', operation: '/api/services' }],
      })
    );
    expect(mock).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', operation: '/api/services' }],
      })
    );

    expect(response.data[0].meta.preferredVisualisationType).toBe('table');
    expect(response.data[0].fields[0].config.links).toHaveLength(1);
    expect(response.data[0].fields[0].name).toBe('traceID');
  });

  it.skip('should show error when no service is selected for search', async () => {
    setupQueryMock('search');
    const ds = new JaegerDatasource(defaultSettings);
    const response = await lastValueFrom(
      ds.query({
        ...defaultQuery,
        targets: [{ queryType: 'search', refId: 'a', service: undefined, operation: '/api/services' }],
      })
    );
    expect(response.error?.message).toBe('You must select a service.');
  });

  it.skip('should resolve template variables in trace ID', async () => {
    const mock = setupQueryMock('trace');
    const ds = new JaegerDatasource(defaultSettings);

    await lastValueFrom(
      ds.query({
        ...defaultQuery,
        scopedVars: {
          $traceid: {
            text: 'traceid',
            value: '5311b0dd0ca8df3463df93c99cb805a6',
          },
        },
        targets: [
          {
            query: '$traceid',
            refId: '1',
          },
        ],
      })
    );
    expect(mock).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [{ query: '$traceid', refId: '1' }],
      })
    );
  });

  it.skip('should resolve template variables in search tags', async () => {
    const mock = setupQueryMock('search');
    const ds = new JaegerDatasource(defaultSettings);
    await lastValueFrom(
      ds.query({
        ...defaultQuery,
        scopedVars: {
          'error=$error': {
            text: 'error',
            value: 'error=true',
          },
        },
        targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', tags: 'error=$error' }],
      })
    );
    expect(mock).toHaveBeenCalledWith({
      url: `${defaultSettings.url}/api/traces?service=jaeger-query&tags=%7B%22error%22%3A%22true%22%7D&${defaultSearchRangeParams}&lookback=custom`,
    });
  });

  it.skip('should interpolate template variables in search parameters', async () => {
    const mock = setupQueryMock('search');
    const ds = new JaegerDatasource(defaultSettings);
    const text = 'interpolationText';
    await lastValueFrom(
      ds.query({
        ...defaultQuery,
        scopedVars: {
          $interpolationVar: {
            text: text,
            value: text,
          },
        },
        targets: [
          {
            queryType: 'search',
            refId: 'a',
            service: '$interpolationVar',
            operation: '$interpolationVar',
            minDuration: '$interpolationVar',
            maxDuration: '$interpolationVar',
          },
        ],
      })
    );
    expect(mock).toHaveBeenCalledWith({
      url: `${defaultSettings.url}/api/traces?service=interpolationText&operation=interpolationText&minDuration=interpolationText&maxDuration=interpolationText&${defaultSearchRangeParams}&lookback=custom`,
    });
  });

  it('should include node graph frames when nodeGraph is enabled for trace queries', async () => {
    // Create a datasource with nodeGraph enabled
    const settings = {
      ...defaultSettings,
      jsonData: {
        ...defaultSettings.jsonData,
        nodeGraph: { enabled: true },
      },
    };

    const ds = new JaegerDatasource(settings);

    // Mock the super.query method to return our mock response
    jest.spyOn(DataSourceWithBackend.prototype, 'query').mockImplementation(() => {
      return of({
        data: [
          {
            fields: testResponseDataFrameFields,
            values: testResponseDataFrameFields.values,
          },
        ],
      });
    });

    // Create a query without queryType (trace ID query)
    const query = {
      ...defaultQuery,
      targets: [
        {
          query: '12345',
          refId: '1',
        },
      ],
    };

    // Execute the query
    const response = await lastValueFrom(ds.query(query));
    // Verify that the response contains the original data plus node graph frames
    expect(response.data.length).toBe(3);
  });

  it('should exclude node graph frames when nodeGraph is disabled for trace queries', async () => {
    // Create a datasource with nodeGraph disabled
    const settings = {
      ...defaultSettings,
      jsonData: {
        ...defaultSettings.jsonData,
        nodeGraph: { enabled: false },
      },
    };

    const ds = new JaegerDatasource(settings);

    // Mock the super.query method to return our mock response
    jest.spyOn(DataSourceWithBackend.prototype, 'query').mockImplementation(() => {
      return of({
        data: [
          {
            fields: testResponseDataFrameFields,
            values: testResponseDataFrameFields.values,
          },
        ],
      });
    });

    // Create a query without queryType (trace ID query)
    const query = {
      ...defaultQuery,
      targets: [
        {
          query: '12345',
          refId: '1',
        },
      ],
    };

    // Execute the query
    const response = await lastValueFrom(ds.query(query));
    // Verify that the response contains only the original data
    expect(response.data.length).toBe(1);
    expect(response.data[0].fields).toMatchObject(testResponseDataFrameFields);
  });

  it('should successfully test datasource connection', async () => {
    setupTestDatasourceMock('success');

    const ds = new JaegerDatasource(defaultSettings);
    const response = await ds.testDatasource();
    expect(response.status).toEqual('success');
    expect(response.message).toBe('Data source connected and services found.');
  });

  it('should display error when datasource test returns no services', async () => {
    setupTestDatasourceMock('error');

    const ds = new JaegerDatasource(defaultSettings);
    const response = await ds.testDatasource();
    expect(response.status).toEqual('error');
    expect(response.message).toBe(
      'Data source connected, but no services received. Verify that Jaeger is configured properly.'
    );
  });

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

function setupTestDatasourceMock(status: 'success' | 'error') {
  return jest.spyOn(DataSourceWithBackend.prototype, 'testDatasource').mockImplementation(async () => {
    if (status === 'success') {
      return {
        status: 'success',
        message: 'Data source connected and services found.',
      };
    } else {
      return {
        status: 'error',
        message: 'Data source connected, but no services received. Verify that Jaeger is configured properly.',
      };
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

const defaultSearchRangeParams = `start=${Number(defaultQuery.range.from) * 1000}&end=${Number(defaultQuery.range.to) * 1000}`;

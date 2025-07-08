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
  beforeEach(() => {
    jest.clearAllMocks();

    const fetchMock = jest.spyOn(Date, 'now');
    fetchMock.mockImplementation(() => 1704106800000); // milliseconds for 2024-01-01 at 11:00am UTC
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.skip('returns trace and graph when queried', async () => {
    setupFetchMockV2('trace');

    const ds = new JaegerDatasource(defaultSettings);
    const response = await lastValueFrom(ds.query(defaultQuery));
    expect(response.data.length).toBe(3);
    expect(response.data[0].fields).toMatchObject(testResponseDataFrameFields);
    expect(response.data[1].fields).toMatchObject(testResponseNodesFields);
    expect(response.data[2].fields).toMatchObject(testResponseEdgesFields);
  });

  it('returns trace when traceId with special characters is queried', async () => {
    const mock = setupFetchMockV2('trace');

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

  it('returns empty response if trace id is not specified', async () => {
    const ds = new JaegerDatasource(defaultSettings);
    const response = await lastValueFrom(ds.query({ ...defaultQuery, targets: [] }));
    const field = response.data[0].fields[0];
    expect(field.name).toBe('trace');
    expect(field.type).toBe(FieldType.trace);
    expect(field.values.length).toBe(0);
  });

  it('should handle json file upload', async () => {
    const ds = new JaegerDatasource(defaultSettings);
    ds.uploadedJson = JSON.stringify(mockJson);
    const response = await lastValueFrom(ds.query({ ...defaultQuery, targets: [{ queryType: 'upload', refId: 'A' }] }));
    const field = response.data[0].fields[0];
    expect(field.name).toBe('traceID');
    expect(field.type).toBe(FieldType.string);
    expect(field.values.length).toBe(2);
  });

  it('should fail on invalid json file upload', async () => {
    const ds = new JaegerDatasource(defaultSettings);
    ds.uploadedJson = JSON.stringify({ key: 'value', arr: [] });
    const response = await lastValueFrom(
      ds.query({ targets: [{ queryType: 'upload', refId: 'A' }] } as DataQueryRequest<JaegerQuery>)
    );
    expect(response.error?.message).toBe('The JSON file uploaded is not in a valid Jaeger format');
    expect(response.data.length).toBe(0);
  });

  it('should return search results when the query type is search', async () => {
    const mock = setupFetchMockV2('search');
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

  it.skip('should show the correct error message if no service name is selected', async () => {
    setupFetchMockV2('search');
    const ds = new JaegerDatasource(defaultSettings);
    const response = await lastValueFrom(
      ds.query({
        ...defaultQuery,
        targets: [{ queryType: 'search', refId: 'a', service: undefined, operation: '/api/services' }],
      })
    );
    expect(response.error?.message).toBe('You must select a service.');
  });

  it.skip('should resolve templates in traceID', async () => {
    const mock = setupFetchMockV2('trace');
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

  it.skip('should resolve templates in tags', async () => {
    const mock = setupFetchMockV2('trace');
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

  it.skip('should interpolate variables correctly', async () => {
    const mock = setupFetchMockV2('search');
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

  describe('when jaegerBackendMigration feature toggle is enabled', () => {
    it('should add node graph frames to response when nodeGraph is enabled and query is a trace ID query', async () => {
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

    it('should not add node graph frames when nodeGraph is disabled', async () => {
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
  });
});

describe('when performing testDataSource', () => {
  describe('and call succeeds', () => {
    it('should return successfully', async () => {
      setupTestDatasourceMock('success');

      const ds = new JaegerDatasource(defaultSettings);
      const response = await ds.testDatasource();
      expect(response.status).toEqual('success');
      expect(response.message).toBe('Data source connected and services found.');
    });
  });

  describe('and call succeeds, but returns no services', () => {
    it('should display an error', async () => {
      setupTestDatasourceMock('error');

      const ds = new JaegerDatasource(defaultSettings);
      const response = await ds.testDatasource();
      expect(response.status).toEqual('error');
      expect(response.message).toBe(
        'Data source connected, but no services received. Verify that Jaeger is configured properly.'
      );
    });
  });
});

describe('Test behavior with unmocked time', () => {
  // Tolerance for checking timestamps.
  // Using a lower number seems to cause flaky tests.
  const numDigits = -4;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('getTimeRange()', async () => {
    const ds = new JaegerDatasource(defaultSettings);
    const timeRange = ds.getTimeRange();
    const now = Date.now();
    expect(timeRange.end).toBeCloseTo(now * 1000, numDigits);
    expect(timeRange.start).toBeCloseTo((now - 6 * 3600 * 1000) * 1000, numDigits);
  });
});

function setupFetchMockV2(type: 'trace' | 'search') {
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

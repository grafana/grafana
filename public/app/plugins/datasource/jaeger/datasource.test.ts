import { lastValueFrom, of, throwError } from 'rxjs';

import {
  DataQueryRequest,
  DataSourceInstanceSettings,
  dateTime,
  FieldType,
  PluginMetaInfo,
  PluginType,
  ScopedVars,
} from '@grafana/data';
import { BackendSrv } from '@grafana/runtime';

import { ALL_OPERATIONS_KEY } from './components/SearchForm';
import { JaegerDatasource, JaegerJsonData } from './datasource';
import { createFetchResponse } from './helpers/createFetchResponse';
import mockJson from './mockJsonResponse.json';
import {
  testResponse,
  testResponseDataFrameFields,
  testResponseEdgesFields,
  testResponseNodesFields,
} from './testResponse';
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

describe('JaegerDatasource', () => {
  const defaultSearchRangeParams = `start=${Number(defaultQuery.range.from) * 1000}&end=${Number(defaultQuery.range.to) * 1000}`;

  beforeEach(() => {
    jest.clearAllMocks();

    const fetchMock = jest.spyOn(Date, 'now');
    fetchMock.mockImplementation(() => 1704106800000); // milliseconds for 2024-01-01 at 11:00am UTC
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns trace and graph when queried', async () => {
    setupFetchMock({ data: [testResponse] });

    const ds = new JaegerDatasource(defaultSettings);
    const response = await lastValueFrom(ds.query(defaultQuery));
    expect(response.data.length).toBe(3);
    expect(response.data[0].fields).toMatchObject(testResponseDataFrameFields);
    expect(response.data[1].fields).toMatchObject(testResponseNodesFields);
    expect(response.data[2].fields).toMatchObject(testResponseEdgesFields);
  });

  it('returns trace when traceId with special characters is queried', async () => {
    const mock = setupFetchMock({ data: [testResponse] });
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
    expect(mock).toHaveBeenCalledWith({ url: `${defaultSettings.url}/api/traces/a%2Fb` });
  });

  it('should trim whitespace from traceid', async () => {
    const mock = setupFetchMock({ data: [testResponse] });
    const ds = new JaegerDatasource(defaultSettings);
    const query = {
      ...defaultQuery,
      targets: [
        {
          query: 'a/b  ',
          refId: '1',
        },
      ],
    };
    await lastValueFrom(ds.query(query));
    expect(mock).toHaveBeenCalledWith({ url: `${defaultSettings.url}/api/traces/a%2Fb` });
  });

  it('returns empty response if trace id is not specified', async () => {
    const ds = new JaegerDatasource(defaultSettings);
    const response = await lastValueFrom(
      ds.query({
        ...defaultQuery,
        targets: [],
      })
    );
    const field = response.data[0].fields[0];
    expect(field.name).toBe('trace');
    expect(field.type).toBe(FieldType.trace);
    expect(field.values.length).toBe(0);
  });

  it('should handle json file upload', async () => {
    const ds = new JaegerDatasource(defaultSettings);
    ds.uploadedJson = JSON.stringify(mockJson);
    const response = await lastValueFrom(
      ds.query({
        ...defaultQuery,
        targets: [{ queryType: 'upload', refId: 'A' }],
      })
    );
    const field = response.data[0].fields[0];
    expect(field.name).toBe('traceID');
    expect(field.type).toBe(FieldType.string);
    expect(field.values.length).toBe(2);
  });

  it('should fail on invalid json file upload', async () => {
    const ds = new JaegerDatasource(defaultSettings);
    ds.uploadedJson = JSON.stringify({ key: 'value', arr: [] });
    const response = await lastValueFrom(
      ds.query({
        targets: [{ queryType: 'upload', refId: 'A' }],
      } as DataQueryRequest<JaegerQuery>)
    );
    expect(response.error?.message).toBe('The JSON file uploaded is not in a valid Jaeger format');
    expect(response.data.length).toBe(0);
  });

  it('should return search results when the query type is search', async () => {
    const mock = setupFetchMock({ data: [testResponse] });
    const ds = new JaegerDatasource(defaultSettings);
    const response = await lastValueFrom(
      ds.query({
        ...defaultQuery,
        targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', operation: '/api/services' }],
      })
    );
    expect(mock).toHaveBeenCalledWith({
      url: `${defaultSettings.url}/api/traces?service=jaeger-query&operation=%2Fapi%2Fservices&${defaultSearchRangeParams}&lookback=custom`,
    });
    expect(response.data[0].meta.preferredVisualisationType).toBe('table');
    // Make sure that traceID field has data link configured
    expect(response.data[0].fields[0].config.links).toHaveLength(1);
    expect(response.data[0].fields[0].name).toBe('traceID');
  });

  it('uses default range when no range is provided for search query,', async () => {
    const mock = setupFetchMock({ data: [testResponse] });
    const ds = new JaegerDatasource(defaultSettings);
    const query = {
      ...defaultQuery,
      targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', operation: ALL_OPERATIONS_KEY }],
      // set range to undefined to test default range
      range: undefined,
    } as unknown as DataQueryRequest<JaegerQuery>;

    ds.query(query);
    expect(mock).toHaveBeenCalledWith({
      // Check that query has time range from 6 hours ago to now (default range)
      url: `${defaultSettings.url}/api/traces?service=jaeger-query&start=1704085200000000&end=1704106800000000&lookback=custom`,
    });
  });

  it('should show the correct error message if no service name is selected', async () => {
    const ds = new JaegerDatasource(defaultSettings);
    const response = await lastValueFrom(
      ds.query({
        ...defaultQuery,
        targets: [{ queryType: 'search', refId: 'a', service: undefined, operation: '/api/services' }],
      })
    );
    expect(response.error?.message).toBe('You must select a service.');
  });

  it('should remove operation from the query when all is selected', async () => {
    const mock = setupFetchMock({ data: [testResponse] });
    const ds = new JaegerDatasource(defaultSettings);
    await lastValueFrom(
      ds.query({
        ...defaultQuery,
        targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', operation: ALL_OPERATIONS_KEY }],
      })
    );
    expect(mock).toHaveBeenCalledWith({
      url: `${defaultSettings.url}/api/traces?service=jaeger-query&${defaultSearchRangeParams}&lookback=custom`,
    });
  });

  it('should convert tags from logfmt format to an object', async () => {
    const mock = setupFetchMock({ data: [testResponse] });
    const ds = new JaegerDatasource(defaultSettings);
    await lastValueFrom(
      ds.query({
        ...defaultQuery,
        targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', tags: 'error=true' }],
      })
    );
    expect(mock).toHaveBeenCalledWith({
      url: `${defaultSettings.url}/api/traces?service=jaeger-query&tags=%7B%22error%22%3A%22true%22%7D&${defaultSearchRangeParams}&lookback=custom`,
    });
  });

  it('should resolve templates in traceID', async () => {
    const mock = setupFetchMock({ data: [testResponse] });
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
    expect(mock).toHaveBeenCalledWith({
      url: `${defaultSettings.url}/api/traces/5311b0dd0ca8df3463df93c99cb805a6`,
    });
  });

  it('should resolve templates in tags', async () => {
    const mock = setupFetchMock({ data: [testResponse] });
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

  it('should interpolate variables correctly', async () => {
    const mock = setupFetchMock({ data: [testResponse] });
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
});

describe('when performing testDataSource', () => {
  describe('and call succeeds', () => {
    it('should return successfully', async () => {
      setupFetchMock({ data: ['service1'] });

      const ds = new JaegerDatasource(defaultSettings);
      const response = await ds.testDatasource();
      expect(response.status).toEqual('success');
      expect(response.message).toBe('Data source connected and services found.');
    });
  });

  describe('and call succeeds, but returns no services', () => {
    it('should display an error', async () => {
      setupFetchMock(undefined);

      const ds = new JaegerDatasource(defaultSettings);
      const response = await ds.testDatasource();
      expect(response.status).toEqual('error');
      expect(response.message).toBe(
        'Data source connected, but no services received. Verify that Jaeger is configured properly.'
      );
    });
  });

  describe('and call returns error with message', () => {
    it('should return the formatted error', async () => {
      setupFetchMock(
        undefined,
        throwError({
          statusText: 'Not found',
          status: 404,
          data: {
            message: '404 page not found',
          },
        })
      );

      const ds = new JaegerDatasource(defaultSettings);
      const response = await ds.testDatasource();
      expect(response.status).toEqual('error');
      expect(response.message).toBe('Jaeger: Not found. 404. 404 page not found');
    });
  });

  describe('and call returns error without message', () => {
    it('should return JSON error', async () => {
      setupFetchMock(
        undefined,
        throwError({
          statusText: 'Bad gateway',
          status: 502,
          data: {
            errors: ['Could not connect to Jaeger backend'],
          },
        })
      );

      const ds = new JaegerDatasource(defaultSettings);
      const response = await ds.testDatasource();
      expect(response.status).toEqual('error');
      expect(response.message).toBe('Jaeger: Bad gateway. 502. {"errors":["Could not connect to Jaeger backend"]}');
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

  it("call for `query()` when `queryType === 'dependencyGraph'`", async () => {
    const mock = setupFetchMock({ data: [testResponse] });
    const ds = new JaegerDatasource(defaultSettings);
    const now = Date.now();

    ds.query({ ...defaultQuery, targets: [{ queryType: 'dependencyGraph', refId: '1' }] });

    const url = mock.mock.calls[0][0].url;
    const endTsMatch = url.match(/endTs=(\d+)/);
    expect(endTsMatch).not.toBeNull();
    expect(parseInt(endTsMatch![1], 10)).toBeCloseTo(now, numDigits);

    const lookbackMatch = url.match(/lookback=(\d+)/);
    expect(lookbackMatch).not.toBeNull();
    expect(parseInt(lookbackMatch![1], 10)).toBeCloseTo(3600000, -1); // due to rounding, the least significant digit is not reliable
  });

  it("call for `query()` when `queryType === 'dependencyGraph'`, using default range", async () => {
    const mock = setupFetchMock({ data: [testResponse] });
    const ds = new JaegerDatasource(defaultSettings);
    const now = Date.now();
    const query = JSON.parse(JSON.stringify(defaultQuery));
    // @ts-ignore
    query.range = undefined;

    ds.query({ ...query, targets: [{ queryType: 'dependencyGraph', refId: '1' }] });

    const url = mock.mock.calls[0][0].url;
    const endTsMatch = url.match(/endTs=(\d+)/);
    expect(endTsMatch).not.toBeNull();
    expect(parseInt(endTsMatch![1], 10)).toBeCloseTo(now, numDigits);

    const lookbackMatch = url.match(/lookback=(\d+)/);
    expect(lookbackMatch).not.toBeNull();
    expect(parseInt(lookbackMatch![1], 10)).toBeCloseTo(21600000, -1);
  });
});

function setupFetchMock(response: unknown, mock?: ReturnType<typeof backendSrv.fetch>) {
  const defaultMock = () => mock ?? of(createFetchResponse(response));

  const fetchMock = jest.spyOn(backendSrv, 'fetch');
  fetchMock.mockImplementation(defaultMock);
  return fetchMock;
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

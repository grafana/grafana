import { DataQueryRequest, DataSourceInstanceSettings, dateTime, FieldType, PluginType } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import { of, throwError } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { ALL_OPERATIONS_KEY } from './components/SearchForm';
import { JaegerDatasource } from './datasource';
import mockJson from './mockJsonResponse.json';
import {
  testResponse,
  testResponseDataFrameFields,
  testResponseEdgesFields,
  testResponseNodesFields,
} from './testResponse';
import { JaegerQuery } from './types';

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
}));

const timeSrvStub: any = {
  timeRange(): any {
    return {
      from: dateTime(1531468681),
      to: dateTime(1531489712),
    };
  },
};

describe('JaegerDatasource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns trace and graph when queried', async () => {
    setupFetchMock({ data: [testResponse] });

    const ds = new JaegerDatasource(defaultSettings);
    const response = await ds.query(defaultQuery).toPromise();
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
    await ds.query(query).toPromise();
    expect(mock).toBeCalledWith({ url: `${defaultSettings.url}/api/traces/a%2Fb` });
  });

  it('returns empty response if trace id is not specified', async () => {
    const ds = new JaegerDatasource(defaultSettings);
    const response = await ds
      .query({
        ...defaultQuery,
        targets: [],
      })
      .toPromise();
    const field = response.data[0].fields[0];
    expect(field.name).toBe('trace');
    expect(field.type).toBe(FieldType.trace);
    expect(field.values.length).toBe(0);
  });

  it('should handle json file upload', async () => {
    const ds = new JaegerDatasource(defaultSettings);
    ds.uploadedJson = JSON.stringify(mockJson);
    const response = await ds
      .query({
        ...defaultQuery,
        targets: [{ queryType: 'upload', refId: 'A' }],
      })
      .toPromise();
    const field = response.data[0].fields[0];
    expect(field.name).toBe('traceID');
    expect(field.type).toBe(FieldType.string);
    expect(field.values.length).toBe(2);
  });

  it('should return search results when the query type is search', async () => {
    const mock = setupFetchMock({ data: [testResponse] });
    const ds = new JaegerDatasource(defaultSettings, timeSrvStub);
    const response = await ds
      .query({
        ...defaultQuery,
        targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', operation: '/api/services' }],
      })
      .toPromise();
    expect(mock).toBeCalledWith({
      url: `${defaultSettings.url}/api/traces?operation=%2Fapi%2Fservices&service=jaeger-query&start=1531468681000&end=1531489712000&lookback=custom`,
    });
    expect(response.data[0].meta.preferredVisualisationType).toBe('table');
    // Make sure that traceID field has data link configured
    expect(response.data[0].fields[0].config.links).toHaveLength(1);
    expect(response.data[0].fields[0].name).toBe('traceID');
  });

  it('should remove operation from the query when all is selected', async () => {
    const mock = setupFetchMock({ data: [testResponse] });
    const ds = new JaegerDatasource(defaultSettings, timeSrvStub);
    await ds
      .query({
        ...defaultQuery,
        targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', operation: ALL_OPERATIONS_KEY }],
      })
      .toPromise();
    expect(mock).toBeCalledWith({
      url: `${defaultSettings.url}/api/traces?service=jaeger-query&start=1531468681000&end=1531489712000&lookback=custom`,
    });
  });

  it('should convert tags from logfmt format to an object', async () => {
    const mock = setupFetchMock({ data: [testResponse] });
    const ds = new JaegerDatasource(defaultSettings, timeSrvStub);
    await ds
      .query({
        ...defaultQuery,
        targets: [{ queryType: 'search', refId: 'a', service: 'jaeger-query', tags: 'error=true' }],
      })
      .toPromise();
    expect(mock).toBeCalledWith({
      url: `${defaultSettings.url}/api/traces?service=jaeger-query&tags=%7B%22error%22%3A%22true%22%7D&start=1531468681000&end=1531489712000&lookback=custom`,
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

function setupFetchMock(response: any, mock?: any) {
  const defaultMock = () => mock ?? of(createFetchResponse(response));

  const fetchMock = jest.spyOn(backendSrv, 'fetch');
  fetchMock.mockImplementation(defaultMock);
  return fetchMock;
}

const defaultSettings: DataSourceInstanceSettings = {
  id: 0,
  uid: '0',
  type: 'tracing',
  name: 'jaeger',
  url: 'http://grafana.com',
  meta: {
    id: 'jaeger',
    name: 'jaeger',
    type: PluginType.datasource,
    info: {} as any,
    module: '',
    baseUrl: '',
  },
  jsonData: {},
};

const defaultQuery: DataQueryRequest<JaegerQuery> = {
  requestId: '1',
  dashboardId: 0,
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

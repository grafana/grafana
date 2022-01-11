import { lastValueFrom, Observable, of } from 'rxjs';
import {
  DataFrame,
  dataFrameToJSON,
  DataSourceInstanceSettings,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  MutableDataFrame,
  PluginType,
} from '@grafana/data';

import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { BackendDataSourceResponse, FetchResponse, setBackendSrv, setDataSourceSrv } from '@grafana/runtime';
import { DEFAULT_LIMIT, TempoJsonData, TempoDatasource, TempoQuery } from './datasource';
import mockJson from './mockJsonResponse.json';

describe('Tempo data source', () => {
  it('returns empty response when traceId is empty', async () => {
    const ds = new TempoDatasource(defaultSettings);
    const response = await lastValueFrom(
      ds.query({ targets: [{ refId: 'refid1', queryType: 'traceId', query: '' } as Partial<TempoQuery>] } as any),
      { defaultValue: 'empty' }
    );
    expect(response).toBe('empty');
  });

  it('parses json fields from backend', async () => {
    setupBackendSrv(
      new MutableDataFrame({
        fields: [
          { name: 'traceID', values: ['04450900759028499335'] },
          { name: 'spanID', values: ['4322526419282105830'] },
          { name: 'parentSpanID', values: [''] },
          { name: 'operationName', values: ['store.validateQueryTimeRange'] },
          { name: 'startTime', values: [1619712655875.4539] },
          { name: 'duration', values: [14.984] },
          { name: 'serviceTags', values: ['{"key":"servicetag1","value":"service"}'] },
          { name: 'logs', values: ['{"timestamp":12345,"fields":[{"key":"count","value":1}]}'] },
          { name: 'tags', values: ['{"key":"tag1","value":"val1"}'] },
          { name: 'serviceName', values: ['service'] },
        ],
      })
    );
    const ds = new TempoDatasource(defaultSettings);
    const response = await lastValueFrom(ds.query({ targets: [{ refId: 'refid1', query: '12345' }] } as any));

    expect(
      (response.data[0] as DataFrame).fields.map((f) => ({
        name: f.name,
        values: f.values.toArray(),
      }))
    ).toMatchObject([
      { name: 'traceID', values: ['04450900759028499335'] },
      { name: 'spanID', values: ['4322526419282105830'] },
      { name: 'parentSpanID', values: [''] },
      { name: 'operationName', values: ['store.validateQueryTimeRange'] },
      { name: 'startTime', values: [1619712655875.4539] },
      { name: 'duration', values: [14.984] },
      { name: 'serviceTags', values: [{ key: 'servicetag1', value: 'service' }] },
      { name: 'logs', values: [{ timestamp: 12345, fields: [{ key: 'count', value: 1 }] }] },
      { name: 'tags', values: [{ key: 'tag1', value: 'val1' }] },
      { name: 'serviceName', values: ['service'] },
    ]);

    expect(
      (response.data[1] as DataFrame).fields.map((f) => ({
        name: f.name,
        values: f.values.toArray(),
      }))
    ).toMatchObject([
      { name: 'id', values: ['4322526419282105830'] },
      { name: 'title', values: ['service'] },
      { name: 'subTitle', values: ['store.validateQueryTimeRange'] },
      { name: 'mainStat', values: ['14.98ms (100%)'] },
      { name: 'secondaryStat', values: ['14.98ms (100%)'] },
      { name: 'color', values: [1.000007560204647] },
    ]);

    expect(
      (response.data[2] as DataFrame).fields.map((f) => ({
        name: f.name,
        values: f.values.toArray(),
      }))
    ).toMatchObject([
      { name: 'id', values: [] },
      { name: 'target', values: [] },
      { name: 'source', values: [] },
    ]);
  });

  it('runs service graph queries', async () => {
    const ds = new TempoDatasource({
      ...defaultSettings,
      jsonData: {
        serviceMap: {
          datasourceUid: 'prom',
        },
      },
    });
    setDataSourceSrv(backendSrvWithPrometheus as any);
    const response = await lastValueFrom(
      ds.query({ targets: [{ queryType: 'serviceMap' }], range: getDefaultTimeRange() } as any)
    );

    expect(response.data).toHaveLength(2);
    expect(response.data[0].name).toBe('Nodes');
    expect(response.data[0].fields[0].values.length).toBe(3);
    expect(response.data[0].fields[0].config.links.length).toBeGreaterThan(0);

    expect(response.data[1].name).toBe('Edges');
    expect(response.data[1].fields[0].values.length).toBe(2);

    expect(response.state).toBe(LoadingState.Done);
  });

  it('should handle json file upload', async () => {
    const ds = new TempoDatasource(defaultSettings);
    ds.uploadedJson = JSON.stringify(mockJson);
    const response = await lastValueFrom(
      ds.query({
        targets: [{ queryType: 'upload', refId: 'A' }],
      } as any)
    );
    const field = response.data[0].fields[0];
    expect(field.name).toBe('traceID');
    expect(field.type).toBe(FieldType.string);
    expect(field.values.get(0)).toBe('60ba2abb44f13eae');
    expect(field.values.length).toBe(6);
  });

  it('should fail on invalid json file upload', async () => {
    const ds = new TempoDatasource(defaultSettings);
    ds.uploadedJson = JSON.stringify(mockInvalidJson);
    const response = await lastValueFrom(
      ds.query({
        targets: [{ queryType: 'upload', refId: 'A' }],
      } as any)
    );
    expect(response.error?.message).toBeDefined();
    expect(response.data.length).toBe(0);
  });

  it('should build search query correctly', () => {
    const ds = new TempoDatasource(defaultSettings);
    const tempoQuery: TempoQuery = {
      queryType: 'search',
      refId: 'A',
      query: '',
      serviceName: 'frontend',
      spanName: '/config',
      search: 'root.http.status_code=500',
      minDuration: '1ms',
      maxDuration: '100s',
      limit: 10,
    };
    const builtQuery = ds.buildSearchQuery(tempoQuery);
    expect(builtQuery).toStrictEqual({
      tags: 'root.http.status_code=500 service.name="frontend" name="/config"',
      minDuration: '1ms',
      maxDuration: '100s',
      limit: 10,
    });
  });

  it('should include a default limit', () => {
    const ds = new TempoDatasource(defaultSettings);
    const tempoQuery: TempoQuery = {
      queryType: 'search',
      refId: 'A',
      query: '',
      search: '',
    };
    const builtQuery = ds.buildSearchQuery(tempoQuery);
    expect(builtQuery).toStrictEqual({
      tags: '',
      limit: DEFAULT_LIMIT,
    });
  });

  it('should include time range if provided', () => {
    const ds = new TempoDatasource(defaultSettings);
    const tempoQuery: TempoQuery = {
      queryType: 'search',
      refId: 'A',
      query: '',
      search: '',
    };
    const timeRange = { startTime: 0, endTime: 1000 };
    const builtQuery = ds.buildSearchQuery(tempoQuery, timeRange);
    expect(builtQuery).toStrictEqual({
      tags: '',
      limit: DEFAULT_LIMIT,
      start: timeRange.startTime,
      end: timeRange.endTime,
    });
  });

  it('formats native search query history correctly', () => {
    const ds = new TempoDatasource(defaultSettings);
    const tempoQuery: TempoQuery = {
      queryType: 'nativeSearch',
      refId: 'A',
      query: '',
      serviceName: 'frontend',
      spanName: '/config',
      search: 'root.http.status_code=500',
      minDuration: '1ms',
      maxDuration: '100s',
      limit: 10,
    };
    const result = ds.getQueryDisplayText(tempoQuery);
    expect(result).toBe(
      'Service Name: frontend, Span Name: /config, Search: root.http.status_code=500, Min Duration: 1ms, Max Duration: 100s, Limit: 10'
    );
  });
});

const backendSrvWithPrometheus = {
  async get(uid: string) {
    if (uid === 'prom') {
      return {
        query() {
          return of({ data: [totalsPromMetric, secondsPromMetric, failedPromMetric] });
        },
      };
    }
    throw new Error('unexpected uid');
  },
};

function setupBackendSrv(frame: DataFrame) {
  setBackendSrv({
    fetch(): Observable<FetchResponse<BackendDataSourceResponse>> {
      return of(
        createFetchResponse({
          results: {
            refid1: {
              frames: [dataFrameToJSON(frame)],
            },
          },
        })
      );
    },
  } as any);
}

const defaultSettings: DataSourceInstanceSettings<TempoJsonData> = {
  id: 0,
  uid: '0',
  type: 'tracing',
  name: 'tempo',
  access: 'proxy',
  meta: {
    id: 'tempo',
    name: 'tempo',
    type: PluginType.datasource,
    info: {} as any,
    module: '',
    baseUrl: '',
  },
  jsonData: {
    nodeGraph: {
      enabled: true,
    },
  },
};

const totalsPromMetric = new MutableDataFrame({
  refId: 'traces_service_graph_request_total',
  fields: [
    { name: 'Time', values: [1628169788000, 1628169788000] },
    { name: 'client', values: ['app', 'lb'] },
    { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
    { name: 'job', values: ['local_scrape', 'local_scrape'] },
    { name: 'server', values: ['db', 'app'] },
    { name: 'tempo_config', values: ['default', 'default'] },
    { name: 'Value #traces_service_graph_request_total', values: [10, 20] },
  ],
});

const secondsPromMetric = new MutableDataFrame({
  refId: 'traces_service_graph_request_server_seconds_sum',
  fields: [
    { name: 'Time', values: [1628169788000, 1628169788000] },
    { name: 'client', values: ['app', 'lb'] },
    { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
    { name: 'job', values: ['local_scrape', 'local_scrape'] },
    { name: 'server', values: ['db', 'app'] },
    { name: 'tempo_config', values: ['default', 'default'] },
    { name: 'Value #traces_service_graph_request_server_seconds_sum', values: [10, 40] },
  ],
});

const failedPromMetric = new MutableDataFrame({
  refId: 'traces_service_graph_request_failed_total',
  fields: [
    { name: 'Time', values: [1628169788000, 1628169788000] },
    { name: 'client', values: ['app', 'lb'] },
    { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
    { name: 'job', values: ['local_scrape', 'local_scrape'] },
    { name: 'server', values: ['db', 'app'] },
    { name: 'tempo_config', values: ['default', 'default'] },
    { name: 'Value #traces_service_graph_request_failed_total', values: [2, 15] },
  ],
});

const mockInvalidJson = {
  batches: [
    {
      resource: {
        attributes: [],
      },
      instrumentation_library_spans: [
        {
          instrumentation_library: {},
          spans: [
            {
              trace_id: 'AAAAAAAAAABguiq7RPE+rg==',
              span_id: 'cmteMBAvwNA=',
              parentSpanId: 'OY8PIaPbma4=',
              name: 'HTTP GET - root',
              kind: 'SPAN_KIND_SERVER',
              startTimeUnixNano: '1627471657255809000',
              endTimeUnixNano: '1627471657256268000',
              attributes: [
                { key: 'http.status_code', value: { intValue: '200' } },
                { key: 'http.method', value: { stringValue: 'GET' } },
                { key: 'http.url', value: { stringValue: '/' } },
                { key: 'component', value: { stringValue: 'net/http' } },
              ],
              status: {},
            },
          ],
        },
      ],
    },
  ],
};

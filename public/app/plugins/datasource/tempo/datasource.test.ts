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
import { Observable, of } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { TempoDatasource } from './datasource';
import { FetchResponse, setBackendSrv, BackendDataSourceResponse, setDataSourceSrv } from '@grafana/runtime';
import mockJson from './mockJsonResponse.json';

describe('Tempo data source', () => {
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
    const response = await ds.query({ targets: [{ refId: 'refid1' }] } as any).toPromise();

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

  it('runs service map queries', async () => {
    const ds = new TempoDatasource({
      ...defaultSettings,
      jsonData: {
        serviceMap: {
          datasourceUid: 'prom',
        },
      },
    });
    setDataSourceSrv(backendSrvWithPrometheus as any);
    const response = await ds
      .query({ targets: [{ queryType: 'serviceMap' }], range: getDefaultTimeRange() } as any)
      .toPromise();

    expect(response.data).toHaveLength(2);
    expect(response.data[0].name).toBe('Nodes');
    expect(response.data[0].fields[0].values.length).toBe(3);

    expect(response.data[1].name).toBe('Edges');
    expect(response.data[1].fields[0].values.length).toBe(2);

    expect(response.state).toBe(LoadingState.Done);
  });

  it('should handle json file upload', async () => {
    const ds = new TempoDatasource(defaultSettings);
    ds.uploadedJson = JSON.stringify(mockJson);
    const response = await ds
      .query({
        targets: [{ queryType: 'upload', refId: 'A' }],
      } as any)
      .toPromise();
    const field = response.data[0].fields[0];
    expect(field.name).toBe('traceID');
    expect(field.type).toBe(FieldType.string);
    expect(field.values.get(0)).toBe('60ba2abb44f13eae');
    expect(field.values.length).toBe(6);
  });
});

const backendSrvWithPrometheus = {
  async get(uid: string) {
    if (uid === 'prom') {
      return {
        query() {
          return of({ data: [totalsPromMetric] }, { data: [secondsPromMetric] });
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

const defaultSettings: DataSourceInstanceSettings = {
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
  jsonData: {},
};

const totalsPromMetric = new MutableDataFrame({
  refId: 'tempo_service_graph_request_total',
  fields: [
    { name: 'Time', values: [1628169788000, 1628169788000] },
    { name: 'client', values: ['app', 'lb'] },
    { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
    { name: 'job', values: ['local_scrape', 'local_scrape'] },
    { name: 'server', values: ['db', 'app'] },
    { name: 'tempo_config', values: ['default', 'default'] },
    { name: 'Value #tempo_service_graph_request_total', values: [10, 20] },
  ],
});

const secondsPromMetric = new MutableDataFrame({
  refId: 'tempo_service_graph_request_server_seconds_sum',
  fields: [
    { name: 'Time', values: [1628169788000, 1628169788000] },
    { name: 'client', values: ['app', 'lb'] },
    { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
    { name: 'job', values: ['local_scrape', 'local_scrape'] },
    { name: 'server', values: ['db', 'app'] },
    { name: 'tempo_config', values: ['default', 'default'] },
    { name: 'Value #tempo_service_graph_request_server_seconds_sum', values: [10, 40] },
  ],
});

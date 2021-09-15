import { createGraphFrames, mapPromMetricsToServiceMap } from './graphTransform';
import { bigResponse } from './testResponse';
import { ArrayVector, DataFrameView, dateTime, MutableDataFrame } from '@grafana/data';

describe('createGraphFrames', () => {
  it('transforms basic response into nodes and edges frame', async () => {
    const frames = createGraphFrames(bigResponse);
    expect(frames.length).toBe(2);
    expect(frames[0].length).toBe(30);
    expect(frames[1].length).toBe(29);

    let view = new DataFrameView(frames[0]);
    expect(view.get(0)).toMatchObject({
      id: '4322526419282105830',
      title: 'loki-all',
      subTitle: 'store.validateQueryTimeRange',
      mainStat: '0ms (0.02%)',
      secondaryStat: '0ms (100%)',
      color: 0.00021968356127648162,
    });

    expect(view.get(29)).toMatchObject({
      id: '4450900759028499335',
      title: 'loki-all',
      subTitle: 'HTTP GET - loki_api_v1_query_range',
      mainStat: '18.21ms (100%)',
      secondaryStat: '3.22ms (17.71%)',
      color: 0.17707117189595056,
    });

    view = new DataFrameView(frames[1]);
    expect(view.get(28)).toMatchObject({
      id: '4450900759028499335--4790760741274015949',
    });
  });

  it('handles single span response', async () => {
    const frames = createGraphFrames(singleSpanResponse);
    expect(frames.length).toBe(2);
    expect(frames[0].length).toBe(1);

    const view = new DataFrameView(frames[0]);
    expect(view.get(0)).toMatchObject({
      id: '4322526419282105830',
      title: 'loki-all',
      subTitle: 'store.validateQueryTimeRange',
      mainStat: '14.98ms (100%)',
      secondaryStat: '14.98ms (100%)',
      color: 1.000007560204647,
    });
  });

  it('handles missing spans', async () => {
    const frames = createGraphFrames(missingSpanResponse);
    expect(frames.length).toBe(2);
    expect(frames[0].length).toBe(2);
    expect(frames[1].length).toBe(0);
  });
});

describe('mapPromMetricsToServiceMap', () => {
  it('transforms prom metrics to service map', async () => {
    const range = {
      from: dateTime('2000-01-01T00:00:00'),
      to: dateTime('2000-01-01T00:01:00'),
    };
    const [nodes, edges] = mapPromMetricsToServiceMap([{ data: [totalsPromMetric] }, { data: [secondsPromMetric] }], {
      ...range,
      raw: range,
    });

    expect(nodes.fields).toMatchObject([
      { name: 'id', values: new ArrayVector(['db', 'app', 'lb']) },
      { name: 'title', values: new ArrayVector(['db', 'app', 'lb']) },
      { name: 'mainStat', values: new ArrayVector([1000, 2000, NaN]) },
      { name: 'secondaryStat', values: new ArrayVector([10, 20, NaN]) },
    ]);
    expect(edges.fields).toMatchObject([
      { name: 'id', values: new ArrayVector(['app_db', 'lb_app']) },
      { name: 'source', values: new ArrayVector(['app', 'lb']) },
      { name: 'target', values: new ArrayVector(['db', 'app']) },
      { name: 'mainStat', values: new ArrayVector([10, 20]) },
      { name: 'secondaryStat', values: new ArrayVector([1000, 2000]) },
    ]);
  });
});

const singleSpanResponse = new MutableDataFrame({
  fields: [
    { name: 'traceID', values: ['04450900759028499335'] },
    { name: 'spanID', values: ['4322526419282105830'] },
    { name: 'parentSpanID', values: [''] },
    { name: 'operationName', values: ['store.validateQueryTimeRange'] },
    { name: 'serviceName', values: ['loki-all'] },
    { name: 'startTime', values: [1619712655875.4539] },
    { name: 'duration', values: [14.984] },
  ],
});

const missingSpanResponse = new MutableDataFrame({
  fields: [
    { name: 'traceID', values: ['04450900759028499335', '04450900759028499335'] },
    { name: 'spanID', values: ['1', '2'] },
    { name: 'parentSpanID', values: ['', '3'] },
    { name: 'operationName', values: ['store.validateQueryTimeRange', 'store.validateQueryTimeRange'] },
    { name: 'serviceName', values: ['loki-all', 'loki-all'] },
    { name: 'startTime', values: [1619712655875.4539, 1619712655880.4539] },
    { name: 'duration', values: [14.984, 4.984] },
  ],
});

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

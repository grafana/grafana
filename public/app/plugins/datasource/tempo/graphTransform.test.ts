import { DataFrameView, dateTime, createDataFrame, FieldType } from '@grafana/data';

import { createGraphFrames, mapPromMetricsToServiceMap } from './graphTransform';
import { bigResponse } from './test/testResponse';

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
      subtitle: 'store.validateQueryTimeRange',
      mainstat: '0ms (0.02%)',
      secondarystat: '0ms (100%)',
      color: 0.00021968356127648162,
    });

    expect(view.get(29)).toMatchObject({
      id: '4450900759028499335',
      title: 'loki-all',
      subtitle: 'HTTP GET - loki_api_v1_query_range',
      mainstat: '18.21ms (100%)',
      secondarystat: '3.22ms (17.71%)',
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
      subtitle: 'store.validateQueryTimeRange',
      mainstat: '14.98ms (100%)',
      secondarystat: '14.98ms (100%)',
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

it('assigns correct field type even if values are numbers', async () => {
  const range = {
    from: dateTime('2000-01-01T00:00:00'),
    to: dateTime('2000-01-01T00:01:00'),
  };
  const { nodes } = mapPromMetricsToServiceMap([{ data: [serverIsANumber, serverIsANumber] }], {
    ...range,
    raw: range,
  });

  expect(nodes.fields).toMatchObject([
    { name: 'id', values: ['0', '1'], type: FieldType.string },
    { name: 'title', values: ['0', '1'], type: FieldType.string },
    { name: 'subtitle', type: FieldType.string, values: [] },
    { name: 'mainstat', values: [NaN, NaN], type: FieldType.number },
    { name: 'secondarystat', values: [10, 20], type: FieldType.number },
    { name: 'arc__success', values: [1, 1], type: FieldType.number },
    { name: 'arc__failed', values: [0, 0], type: FieldType.number },
  ]);
});

it('do not fail on response with empty list', async () => {
  const range = {
    from: dateTime('2000-01-01T00:00:00'),
    to: dateTime('2000-01-01T00:01:00'),
  };
  const { nodes } = mapPromMetricsToServiceMap([], {
    ...range,
    raw: range,
  });

  expect(nodes.fields).toMatchObject([
    { name: 'id', values: [], type: FieldType.string },
    { name: 'title', values: [], type: FieldType.string },
    { name: 'subtitle', type: FieldType.string, values: [] },
    { name: 'mainstat', values: [], type: FieldType.number },
    { name: 'secondarystat', values: [], type: FieldType.number },
    { name: 'arc__success', values: [], type: FieldType.number },
    { name: 'arc__failed', values: [], type: FieldType.number },
  ]);
});

describe('mapPromMetricsToServiceMap', () => {
  it('transforms prom metrics to service graph', async () => {
    const range = {
      from: dateTime('2000-01-01T00:00:00'),
      to: dateTime('2000-01-01T00:01:00'),
    };
    const { nodes, edges } = mapPromMetricsToServiceMap(
      [{ data: [totalsPromMetric(), secondsPromMetric(), failedPromMetric()] }],
      {
        ...range,
        raw: range,
      }
    );

    expect(nodes.fields).toMatchObject([
      { name: 'id', values: ['db', 'app', 'lb'] },
      { name: 'title', values: ['db', 'app', 'lb'] },
      { name: 'subtitle', values: [] },
      { name: 'mainstat', values: [1000, 2000, NaN] },
      { name: 'secondarystat', values: [10, 20, NaN] },
      { name: 'arc__success', values: [0.8, 0.25, 1] },
      { name: 'arc__failed', values: [0.2, 0.75, 0] },
    ]);
    expect(edges.fields).toMatchObject([
      { name: 'id', values: ['app_db', 'lb_app'] },
      { name: 'source', values: ['app', 'lb'] },
      { name: 'sourceName', values: ['app', 'lb'] },
      { name: 'sourceNamespace', values: [undefined, undefined] },
      { name: 'target', values: ['db', 'app'] },
      { name: 'targetName', values: ['db', 'app'] },
      { name: 'targetNamespace', values: [undefined, undefined] },
      { name: 'mainstat', values: [1000, 2000] },
      { name: 'secondarystat', values: [10, 20] },
    ]);
  });

  it('transforms prom metrics to service graph including namespace', async () => {
    const range = {
      from: dateTime('2000-01-01T00:00:00'),
      to: dateTime('2000-01-01T00:01:00'),
    };
    const { nodes, edges } = mapPromMetricsToServiceMap(
      [{ data: [totalsPromMetric(true), secondsPromMetric(true), failedPromMetric(true)] }],
      {
        ...range,
        raw: range,
      }
    );

    expect(nodes.fields).toMatchObject([
      { name: 'id', values: ['ns3/db', 'ns1/app', 'ns2/lb'] },
      { name: 'title', values: ['db', 'app', 'lb'] },
      { name: 'subtitle', values: ['ns3', 'ns1', 'ns2'] },
      { name: 'mainstat', values: [1000, 2000, NaN] },
      { name: 'secondarystat', values: [10, 20, NaN] },
      { name: 'arc__success', values: [0.8, 0.25, 1] },
      { name: 'arc__failed', values: [0.2, 0.75, 0] },
    ]);
    expect(edges.fields).toMatchObject([
      { name: 'id', values: ['ns1/app_ns3/db', 'ns2/lb_ns1/app'] },
      { name: 'source', values: ['ns1/app', 'ns2/lb'] },
      { name: 'sourceName', values: ['app', 'lb'] },
      { name: 'sourceNamespace', values: ['ns1', 'ns2'] },
      { name: 'target', values: ['ns3/db', 'ns1/app'] },
      { name: 'targetName', values: ['db', 'app'] },
      { name: 'targetNamespace', values: ['ns3', 'ns1'] },
      { name: 'mainstat', values: [1000, 2000] },
      { name: 'secondarystat', values: [10, 20] },
    ]);
  });

  it('handles invalid failed count', () => {
    // If node.failed > node.total, the stat circle will render in the wrong position
    // Fixed this by limiting the failed value to the total value
    const range = {
      from: dateTime('2000-01-01T00:00:00'),
      to: dateTime('2000-01-01T00:01:00'),
    };
    const { nodes } = mapPromMetricsToServiceMap(
      [{ data: [totalsPromMetric(), secondsPromMetric(), invalidFailedPromMetric] }],
      {
        ...range,
        raw: range,
      }
    );

    expect(nodes.fields).toMatchObject([
      { name: 'id', values: ['db', 'app', 'lb'] },
      { name: 'title', values: ['db', 'app', 'lb'] },
      { name: 'subtitle', values: [] },
      { name: 'mainstat', values: [1000, 2000, NaN] },
      { name: 'secondarystat', values: [10, 20, NaN] },
      { name: 'arc__success', values: [0, 0, 1] },
      { name: 'arc__failed', values: [1, 1, 0] },
    ]);
  });
});

const singleSpanResponse = createDataFrame({
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

const missingSpanResponse = createDataFrame({
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

const totalsPromMetric = (namespace?: boolean) =>
  createDataFrame({
    refId: 'traces_service_graph_request_total',
    fields: [
      { name: 'Time', values: [1628169788000, 1628169788000] },
      { name: 'client', values: ['app', 'lb'] },
      { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
      { name: 'job', values: ['local_scrape', 'local_scrape'] },
      { name: 'server', values: ['db', 'app'] },
      { name: 'tempo_config', values: ['default', 'default'] },
      { name: 'Value #traces_service_graph_request_total', values: [10, 20] },
      ...(namespace
        ? [
            { name: 'client_service_namespace', values: ['ns1', 'ns2'] },
            { name: 'server_service_namespace', values: ['ns3', 'ns1'] },
          ]
        : []),
    ],
  });

const secondsPromMetric = (namespace?: boolean) =>
  createDataFrame({
    refId: 'traces_service_graph_request_server_seconds_sum',
    fields: [
      { name: 'Time', values: [1628169788000, 1628169788000] },
      { name: 'client', values: ['app', 'lb'] },
      { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
      { name: 'job', values: ['local_scrape', 'local_scrape'] },
      { name: 'server', values: ['db', 'app'] },
      { name: 'tempo_config', values: ['default', 'default'] },
      { name: 'Value #traces_service_graph_request_server_seconds_sum', values: [10, 40] },
      ...(namespace
        ? [
            { name: 'client_service_namespace', values: ['ns1', 'ns2'] },
            { name: 'server_service_namespace', values: ['ns3', 'ns1'] },
          ]
        : []),
    ],
  });

const failedPromMetric = (namespace?: boolean) =>
  createDataFrame({
    refId: 'traces_service_graph_request_failed_total',
    fields: [
      { name: 'Time', values: [1628169788000, 1628169788000] },
      { name: 'client', values: ['app', 'lb'] },
      { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
      { name: 'job', values: ['local_scrape', 'local_scrape'] },
      { name: 'server', values: ['db', 'app'] },
      { name: 'tempo_config', values: ['default', 'default'] },
      { name: 'Value #traces_service_graph_request_failed_total', values: [2, 15] },
      ...(namespace
        ? [
            { name: 'client_service_namespace', values: ['ns1', 'ns2'] },
            { name: 'server_service_namespace', values: ['ns3', 'ns1'] },
          ]
        : []),
    ],
  });

const invalidFailedPromMetric = createDataFrame({
  refId: 'traces_service_graph_request_failed_total',
  fields: [
    { name: 'Time', values: [1628169788000, 1628169788000] },
    { name: 'client', values: ['app', 'lb'] },
    { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
    { name: 'job', values: ['local_scrape', 'local_scrape'] },
    { name: 'server', values: ['db', 'app'] },
    { name: 'tempo_config', values: ['default', 'default'] },
    { name: 'Value #traces_service_graph_request_failed_total', values: [20, 40] },
  ],
});

const serverIsANumber = createDataFrame({
  refId: 'traces_service_graph_request_total',
  fields: [
    { name: 'Time', values: [1628169788000, 1628169788000] },
    { name: 'client', values: ['0', '1'] },
    { name: 'instance', values: ['127.0.0.1:12345', '127.0.0.1:12345'] },
    { name: 'job', values: ['local_scrape', 'local_scrape'] },
    { name: 'server', values: ['0', '1'] },
    { name: 'tempo_config', values: ['default', 'default'] },
    { name: 'Value #traces_service_graph_request_total', values: [10, 20] },
  ],
});

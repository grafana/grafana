import { createDataFrame, DataFrameView } from '@grafana/data';

import { createNodeGraphFrames } from './createNodeGraphFrames';
import { bigTraceResponse } from './mocks/traceResponse';

describe('createGraphFrames', () => {
  it('transforms basic response into nodes and edges frame', async () => {
    const frames = createNodeGraphFrames(bigTraceResponse);
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
    const frames = createNodeGraphFrames(singleSpanResponse);
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
    const frames = createNodeGraphFrames(missingSpanResponse);
    expect(frames.length).toBe(2);
    expect(frames[0].length).toBe(2);
    expect(frames[1].length).toBe(0);
  });
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

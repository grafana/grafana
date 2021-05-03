import { createGraphFrames } from './graphTransform';
import { bigResponse } from './testResponse';
import { DataFrameView } from '@grafana/data';

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
      mainStat: 'total: 0ms (0.02%)',
      secondaryStat: 'self: 0ms (100%)',
      color: 0.00021968356127648162,
    });

    expect(view.get(29)).toMatchObject({
      id: '4450900759028499335',
      title: 'loki-all',
      subTitle: 'HTTP GET - loki_api_v1_query_range',
      mainStat: 'total: 18.21ms (100%)',
      secondaryStat: 'self: 3.22ms (17.71%)',
      color: 0.17707117189595056,
    });

    view = new DataFrameView(frames[1]);
    expect(view.get(28)).toMatchObject({
      id: '4450900759028499335--4790760741274015949',
    });
  });
});

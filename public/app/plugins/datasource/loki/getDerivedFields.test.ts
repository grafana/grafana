import { MutableDataFrame } from '@grafana/data';

import { getDerivedFields } from './getDerivedFields';

jest.mock('@grafana/runtime', () => ({
  // @ts-ignore
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: () => {
        return { name: 'Loki1' };
      },
    };
  },
}));

describe('getDerivedFields', () => {
  it('adds links to fields', () => {
    const df = new MutableDataFrame({ fields: [{ name: 'line', values: ['nothing', 'trace1=1234', 'trace2=foo'] }] });
    const newFields = getDerivedFields(df, [
      {
        matcherRegex: 'trace1=(\\w+)',
        name: 'trace1',
        url: 'http://localhost/${__value.raw}',
      },
      {
        matcherRegex: 'trace2=(\\w+)',
        name: 'trace2',
        url: 'test',
        datasourceUid: 'uid',
      },
      {
        matcherRegex: 'trace2=(\\w+)',
        name: 'trace2',
        url: 'test',
        datasourceUid: 'uid2',
        urlDisplayLabel: 'Custom Label',
      },
    ]);
    expect(newFields.length).toBe(2);
    const trace1 = newFields.find((f) => f.name === 'trace1');
    expect(trace1!.values).toEqual([null, '1234', null]);
    expect(trace1!.config.links![0]).toEqual({
      url: 'http://localhost/${__value.raw}',
      title: '',
    });

    const trace2 = newFields.find((f) => f.name === 'trace2');
    expect(trace2!.values).toEqual([null, null, 'foo']);
    expect(trace2!.config.links!.length).toBe(2);
    expect(trace2!.config.links![0]).toEqual({
      title: '',
      internal: { datasourceName: 'Loki1', datasourceUid: 'uid', query: { query: 'test' } },
      url: '',
    });
    expect(trace2!.config.links![1]).toEqual({
      title: 'Custom Label',
      internal: { datasourceName: 'Loki1', datasourceUid: 'uid2', query: { query: 'test' } },
      url: '',
    });
  });
});

import { createDataFrame } from '@grafana/data';

import { getDerivedFields } from './getDerivedFields';

jest.mock('@grafana/runtime', () => ({
  // @ts-ignore
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: (datasourceUid?: string) => {
        switch (datasourceUid) {
          case 'tempo-datasource-uid':
            return { name: 'Tempo', type: 'tempo' };
          case 'xray-datasource-uid':
            return { name: 'X-ray', type: 'grafana-x-ray-datasource' };
        }
        return { name: 'Loki1' };
      },
    };
  },
}));

describe('getDerivedFields', () => {
  it('adds links to fields', () => {
    const df = createDataFrame({ fields: [{ name: 'line', values: ['nothing', 'trace1=1234', 'trace2=foo'] }] });
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
      {
        matcherRegex: 'trace=(\\w+)',
        name: 'tempoTraceId',
        url: 'test',
        datasourceUid: 'tempo-datasource-uid',
        urlDisplayLabel: 'Tempo',
      },
      {
        matcherRegex: 'trace=(\\w+)',
        name: 'xrayTraceId',
        url: 'test',
        datasourceUid: 'xray-datasource-uid',
        urlDisplayLabel: 'AWS X-ray',
      },
    ]);
    expect(newFields.length).toBe(4);
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

    const tempoTraceId = newFields.find((f) => f.name === 'tempoTraceId');
    expect(tempoTraceId!.values).toEqual([null, null, null]);
    expect(tempoTraceId!.config.links!.length).toBe(1);
    expect(tempoTraceId!.config.links![0]).toEqual({
      title: 'Tempo',
      internal: {
        datasourceName: 'Tempo',
        datasourceUid: 'tempo-datasource-uid',
        query: { query: 'test', queryType: 'traceql' },
      },
      url: '',
    });

    const xrayTraceId = newFields.find((f) => f.name === 'xrayTraceId');
    expect(xrayTraceId!.values).toEqual([null, null, null]);
    expect(xrayTraceId!.config.links!.length).toBe(1);
    expect(xrayTraceId!.config.links![0]).toEqual({
      title: 'AWS X-ray',
      internal: {
        datasourceName: 'X-ray',
        datasourceUid: 'xray-datasource-uid',
        query: { query: 'test', queryType: 'getTrace' },
      },
      url: '',
    });
  });
});

import { createDataFrame } from '@grafana/data';

import { getDerivedFields } from './getDerivedFields';

jest.mock('@grafana/runtime', () => ({
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
        matcherType: 'regex',
        name: 'trace1',
        url: 'http://localhost/${__value.raw}',
      },
      {
        matcherRegex: 'trace2=(\\w+)',
        matcherType: 'regex',
        name: 'trace2',
        url: 'test',
        datasourceUid: 'uid',
      },
      {
        matcherRegex: 'trace2=(\\w+)',
        matcherType: 'regex',
        name: 'trace2',
        url: 'test',
        datasourceUid: 'uid2',
        urlDisplayLabel: 'Custom Label',
      },
      {
        matcherRegex: 'trace=(\\w+)',
        matcherType: 'regex',
        name: 'tempoTraceId',
        url: 'test',
        datasourceUid: 'tempo-datasource-uid',
        urlDisplayLabel: 'Tempo',
      },
      {
        matcherRegex: 'trace=(\\w+)',
        matcherType: 'regex',
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
  it('adds links to fields with labels', () => {
    const df = createDataFrame({
      fields: [
        { name: 'labels', values: [{ trace3: 'bar', trace4: 'blank' }, { trace3: 'tar' }, {}, null] },
        { name: 'line', values: ['nothing', 'trace1=1234', 'trace2=aa', ''] },
      ],
    });
    const newFields = getDerivedFields(df, [
      {
        matcherRegex: 'trace1=(\\w+)',
        matcherType: 'regex',
        name: 'trace1',
        url: 'http://localhost/${__value.raw}',
        targetBlank: true,
      },
      {
        matcherRegex: 'trace3',
        name: 'trace3Name',
        url: 'http://localhost:8080/${__value.raw}',
        matcherType: 'label',
      },
      {
        matcherRegex: 'trace4',
        name: 'trace4Name',
        matcherType: 'regex',
      },
    ]);
    expect(newFields.length).toBe(3);
    const trace1 = newFields.find((f) => f.name === 'trace1');
    expect(trace1!.values).toEqual([null, '1234', null, null]);
    expect(trace1!.config.links![0]).toEqual({
      url: 'http://localhost/${__value.raw}',
      title: '',
      targetBlank: true,
    });

    const trace3 = newFields.find((f) => f.name === 'trace3Name');
    expect(trace3!.values).toEqual(['bar', 'tar', null, null]);
    expect(trace3!.config.links![0]).toEqual({
      url: 'http://localhost:8080/${__value.raw}',
      title: '',
    });

    const trace4 = newFields.find((f) => f.name === 'trace4Name');
    expect(trace4!.values).toEqual([null, null, null, null]);
  });

  it('adds links to fields with no `matcherType`', () => {
    const df = createDataFrame({ fields: [{ name: 'line', values: ['nothing', 'trace1=1234', 'trace2=foo'] }] });
    const newFields = getDerivedFields(df, [
      {
        matcherRegex: 'trace1=(\\w+)',
        name: 'trace1',
        url: 'http://localhost/${__value.raw}',
      },
    ]);
    expect(newFields.length).toBe(1);
    const trace1 = newFields.find((f) => f.name === 'trace1');
    expect(trace1!.values).toEqual([null, '1234', null]);
    expect(trace1!.config.links![0]).toEqual({
      url: 'http://localhost/${__value.raw}',
      title: '',
    });
  });

  it('adds links to fields with `matcherType=regex`', () => {
    const df = createDataFrame({ fields: [{ name: 'line', values: ['nothing', 'trace1=1234', 'trace2=foo'] }] });
    const newFields = getDerivedFields(df, [
      {
        matcherRegex: 'trace1=(\\w+)',
        matcherType: 'regex',
        name: 'trace1',
        url: 'http://localhost/${__value.raw}',
      },
    ]);
    expect(newFields.length).toBe(1);
    const trace1 = newFields.find((f) => f.name === 'trace1');
    expect(trace1!.values).toEqual([null, '1234', null]);
    expect(trace1!.config.links![0]).toEqual({
      url: 'http://localhost/${__value.raw}',
      title: '',
    });
  });

  it('matches label keys using regex when matcherType is label', () => {
    const df = createDataFrame({
      fields: [
        { name: 'labels', values: [{ traceId: 'abc' }, { traceID: 'xyz' }] },
        { name: 'line', values: ['log1', 'log2'] },
      ],
    });
    const newFields = getDerivedFields(df, [
      {
        matcherRegex: 'traceI(d|D)',
        name: 'traceIdFromLabel',
        url: 'http://localhost/${__value.raw}',
        matcherType: 'label',
      },
    ]);
    expect(newFields.length).toBe(1);
    const traceId = newFields.find((f) => f.name === 'traceIdFromLabel');
    expect(traceId!.values).toEqual(['abc', 'xyz']);
    expect(traceId!.config.links![0]).toEqual({
      url: 'http://localhost/${__value.raw}',
      title: '',
    });
  });
});

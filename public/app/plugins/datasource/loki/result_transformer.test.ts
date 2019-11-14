import { logStreamToDataFrame, appendResponseToBufferedData } from './result_transformer';
import { FieldType, MutableDataFrame } from '@grafana/data';
import { LokiLogsStream } from './types';

const streams: LokiLogsStream[] = [
  {
    labels: '{foo="bar"}',
    entries: [
      {
        line: "foo: [32m'bar'[39m",
        ts: '1970-01-01T00:00:00Z',
      },
    ],
  },
  {
    labels: '{bar="foo"}',
    entries: [
      {
        line: "bar: 'foo'",
        ts: '1970-01-01T00:00:00Z',
      },
    ],
  },
];

describe('logStreamToDataFrame', () => {
  it('converts streams to series', () => {
    const data = streams.map(stream => logStreamToDataFrame(stream));

    expect(data.length).toBe(2);
    expect(data[0].fields[1].labels['foo']).toEqual('bar');
    expect(data[0].fields[0].values.get(0)).toEqual(streams[0].entries[0].ts);
    expect(data[0].fields[1].values.get(0)).toEqual(streams[0].entries[0].line);
    expect(data[0].fields[2].values.get(0)).toEqual('1970-01-01T00:00:00Z_{foo="bar"}');
    expect(data[1].fields[0].values.get(0)).toEqual(streams[1].entries[0].ts);
    expect(data[1].fields[1].values.get(0)).toEqual(streams[1].entries[0].line);
    expect(data[1].fields[2].values.get(0)).toEqual('1970-01-01T00:00:00Z_{bar="foo"}');
  });
});

describe('appendResponseToBufferedData', () => {
  it('appends response', () => {
    const data = new MutableDataFrame();
    data.addField({ name: 'ts', type: FieldType.time, config: { title: 'Time' } });
    data.addField({ name: 'line', type: FieldType.string });
    data.addField({ name: 'labels', type: FieldType.other });
    data.addField({ name: 'id', type: FieldType.string });

    appendResponseToBufferedData({ streams }, data);
    expect(data.get(0)).toEqual({
      ts: '1970-01-01T00:00:00Z',
      line: "foo: [32m'bar'[39m",
      labels: { foo: 'bar' },
      id: '1970-01-01T00:00:00Z_{foo="bar"}',
    });
  });
});

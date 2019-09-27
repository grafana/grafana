import { logStreamToDataFrame } from './result_transformer';

describe('convert loki response to DataFrame', () => {
  const streams = [
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
  it('converts streams to series', () => {
    const data = streams.map(stream => logStreamToDataFrame(stream));

    expect(data.length).toBe(2);
    expect(data[0].labels['foo']).toEqual('bar');
    expect(data[0].fields[0].values.get(0)).toEqual(streams[0].entries[0].ts);
    expect(data[0].fields[1].values.get(0)).toEqual(streams[0].entries[0].line);
    expect(data[1].fields[0].values.get(0)).toEqual(streams[1].entries[0].ts);
    expect(data[1].fields[1].values.get(0)).toEqual(streams[1].entries[0].line);
  });
});

import { logStreamToSeriesData } from './result_transformer';

describe('convert loki response to SeriesData', () => {
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
    const data = streams.map(stream => logStreamToSeriesData(stream));

    expect(data.length).toBe(2);
    expect(data[0].labels['foo']).toEqual('bar');
    expect(data[0].rows[0][0]).toEqual(streams[0].entries[0].ts);
    expect(data[0].rows[0][1]).toEqual(streams[0].entries[0].line);
    expect(data[1].rows[0][0]).toEqual(streams[1].entries[0].ts);
    expect(data[1].rows[0][1]).toEqual(streams[1].entries[0].line);
  });
});

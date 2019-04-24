import { LogsStream } from 'app/core/logs_model';

import { mergeStreamsToLogs, logStreamToSeriesData, seriesDataToLogStream } from './result_transformer';

describe('mergeStreamsToLogs()', () => {
  it('returns empty logs given no streams', () => {
    expect(mergeStreamsToLogs([]).rows).toEqual([]);
  });

  it('returns processed logs from single stream', () => {
    const stream1: LogsStream = {
      labels: '{foo="bar"}',
      entries: [
        {
          line: 'WARN boooo',
          ts: '1970-01-01T00:00:00Z',
        },
      ],
    };
    expect(mergeStreamsToLogs([stream1]).rows).toMatchObject([
      {
        entry: 'WARN boooo',
        labels: { foo: 'bar' },
        key: 'EK1970-01-01T00:00:00Z{foo="bar"}',
        logLevel: 'warning',
        uniqueLabels: {},
      },
    ]);
  });

  it('returns merged logs from multiple streams sorted by time and with unique labels', () => {
    const stream1: LogsStream = {
      labels: '{foo="bar", baz="1"}',
      entries: [
        {
          line: 'WARN boooo',
          ts: '1970-01-01T00:00:01Z',
        },
      ],
    };
    const stream2: LogsStream = {
      labels: '{foo="bar", baz="2"}',
      entries: [
        {
          line: 'INFO 1',
          ts: '1970-01-01T00:00:00Z',
        },
        {
          line: 'INFO 2',
          ts: '1970-01-01T00:00:02Z',
        },
      ],
    };
    expect(mergeStreamsToLogs([stream1, stream2]).rows).toMatchObject([
      {
        entry: 'INFO 2',
        labels: { foo: 'bar', baz: '2' },
        logLevel: 'info',
        uniqueLabels: { baz: '2' },
      },
      {
        entry: 'WARN boooo',
        labels: { foo: 'bar', baz: '1' },
        logLevel: 'warning',
        uniqueLabels: { baz: '1' },
      },
      {
        entry: 'INFO 1',
        labels: { foo: 'bar', baz: '2' },
        logLevel: 'info',
        uniqueLabels: { baz: '2' },
      },
    ]);
  });

  it('detects ANSI codes', () => {
    expect(
      mergeStreamsToLogs([
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
      ]).rows
    ).toMatchObject([
      {
        entry: "bar: 'foo'",
        hasAnsi: false,
        key: 'EK1970-01-01T00:00:00Z{bar="foo"}',
        labels: { bar: 'foo' },
        logLevel: 'unknown',
        raw: "bar: 'foo'",
      },
      {
        entry: "foo: 'bar'",
        hasAnsi: true,
        key: 'EK1970-01-01T00:00:00Z{foo="bar"}',
        labels: { foo: 'bar' },
        logLevel: 'unknown',
        raw: "foo: [32m'bar'[39m",
      },
    ]);
  });
});

describe('convert SeriesData to/from LogStream', () => {
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

    const roundtrip = data.map(series => seriesDataToLogStream(series));
    expect(roundtrip.length).toBe(2);
    expect(roundtrip[0].labels).toEqual(streams[0].labels);
  });
});

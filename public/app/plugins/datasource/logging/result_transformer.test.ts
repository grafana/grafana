import { LogLevel, LogsStream } from 'app/core/logs_model';

import {
  findCommonLabels,
  findUniqueLabels,
  formatLabels,
  getLogLevel,
  mergeStreamsToLogs,
  parseLabels,
} from './result_transformer';

describe('getLoglevel()', () => {
  it('returns no log level on empty line', () => {
    expect(getLogLevel('')).toBe(LogLevel.none);
  });

  it('returns no log level on when level is part of a word', () => {
    expect(getLogLevel('this is a warning')).toBe(LogLevel.none);
  });

  it('returns log level on line contains a log level', () => {
    expect(getLogLevel('warn: it is looking bad')).toBe(LogLevel.warn);
    expect(getLogLevel('2007-12-12 12:12:12 [WARN]: it is looking bad')).toBe(LogLevel.warn);
  });

  it('returns first log level found', () => {
    expect(getLogLevel('WARN this could be a debug message')).toBe(LogLevel.warn);
  });
});

describe('parseLabels()', () => {
  it('returns no labels on emtpy labels string', () => {
    expect(parseLabels('')).toEqual({});
    expect(parseLabels('{}')).toEqual({});
  });

  it('returns labels on labels string', () => {
    expect(parseLabels('{foo="bar", baz="42"}')).toEqual({ foo: '"bar"', baz: '"42"' });
  });
});

describe('formatLabels()', () => {
  it('returns no labels on emtpy label set', () => {
    expect(formatLabels({})).toEqual('');
    expect(formatLabels({}, 'foo')).toEqual('foo');
  });

  it('returns label string on label set', () => {
    expect(formatLabels({ foo: '"bar"', baz: '"42"' })).toEqual('{baz="42", foo="bar"}');
  });
});

describe('findCommonLabels()', () => {
  it('returns no common labels on empty sets', () => {
    expect(findCommonLabels([{}])).toEqual({});
    expect(findCommonLabels([{}, {}])).toEqual({});
  });

  it('returns no common labels on differing sets', () => {
    expect(findCommonLabels([{ foo: '"bar"' }, {}])).toEqual({});
    expect(findCommonLabels([{}, { foo: '"bar"' }])).toEqual({});
    expect(findCommonLabels([{ baz: '42' }, { foo: '"bar"' }])).toEqual({});
    expect(findCommonLabels([{ foo: '42', baz: '"bar"' }, { foo: '"bar"' }])).toEqual({});
  });

  it('returns the single labels set as common labels', () => {
    expect(findCommonLabels([{ foo: '"bar"' }])).toEqual({ foo: '"bar"' });
  });
});

describe('findUniqueLabels()', () => {
  it('returns no uncommon labels on empty sets', () => {
    expect(findUniqueLabels({}, {})).toEqual({});
  });

  it('returns all labels given no common labels', () => {
    expect(findUniqueLabels({ foo: '"bar"' }, {})).toEqual({ foo: '"bar"' });
  });

  it('returns all labels except the common labels', () => {
    expect(findUniqueLabels({ foo: '"bar"', baz: '"42"' }, { foo: '"bar"' })).toEqual({ baz: '"42"' });
  });
});

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
          timestamp: '1970-01-01T00:00:00Z',
        },
      ],
    };
    expect(mergeStreamsToLogs([stream1]).rows).toMatchObject([
      {
        entry: 'WARN boooo',
        labels: '{foo="bar"}',
        key: 'EK1970-01-01T00:00:00Z{foo="bar"}',
        logLevel: 'warn',
        uniqueLabels: '',
      },
    ]);
  });

  it('returns merged logs from multiple streams sorted by time and with unique labels', () => {
    const stream1: LogsStream = {
      labels: '{foo="bar", baz="1"}',
      entries: [
        {
          line: 'WARN boooo',
          timestamp: '1970-01-01T00:00:01Z',
        },
      ],
    };
    const stream2: LogsStream = {
      labels: '{foo="bar", baz="2"}',
      entries: [
        {
          line: 'INFO 1',
          timestamp: '1970-01-01T00:00:00Z',
        },
        {
          line: 'INFO 2',
          timestamp: '1970-01-01T00:00:02Z',
        },
      ],
    };
    expect(mergeStreamsToLogs([stream1, stream2]).rows).toMatchObject([
      {
        entry: 'INFO 2',
        labels: '{foo="bar", baz="2"}',
        logLevel: 'info',
        uniqueLabels: '{baz="2"}',
      },
      {
        entry: 'WARN boooo',
        labels: '{foo="bar", baz="1"}',
        logLevel: 'warn',
        uniqueLabels: '{baz="1"}',
      },
      {
        entry: 'INFO 1',
        labels: '{foo="bar", baz="2"}',
        logLevel: 'info',
        uniqueLabels: '{baz="2"}',
      },
    ]);
  });
});

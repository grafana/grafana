import { LogLevel } from 'app/core/logs_model';

import { getLogLevel, getSearchMatches } from './result_transformer';

describe('getSearchMatches()', () => {
  it('gets no matches for when search and or line are empty', () => {
    expect(getSearchMatches('', '')).toEqual([]);
    expect(getSearchMatches('foo', '')).toEqual([]);
    expect(getSearchMatches('', 'foo')).toEqual([]);
  });

  it('gets no matches for unmatched search string', () => {
    expect(getSearchMatches('foo', 'bar')).toEqual([]);
  });

  it('gets matches for matched search string', () => {
    expect(getSearchMatches('foo', 'foo')).toEqual([{ length: 3, start: 0, text: 'foo' }]);
    expect(getSearchMatches(' foo ', 'foo')).toEqual([{ length: 3, start: 1, text: 'foo' }]);
  });

  expect(getSearchMatches(' foo foo bar ', 'foo|bar')).toEqual([
    { length: 3, start: 1, text: 'foo' },
    { length: 3, start: 5, text: 'foo' },
    { length: 3, start: 9, text: 'bar' },
  ]);
});

describe('getLoglevel()', () => {
  it('returns no log level on empty line', () => {
    expect(getLogLevel('')).toBe(undefined);
  });

  it('returns no log level on when level is part of a word', () => {
    expect(getLogLevel('this is a warning')).toBe(undefined);
  });

  it('returns log level on line contains a log level', () => {
    expect(getLogLevel('warn: it is looking bad')).toBe(LogLevel.warn);
    expect(getLogLevel('2007-12-12 12:12:12 [WARN]: it is looking bad')).toBe(LogLevel.warn);
  });

  it('returns first log level found', () => {
    expect(getLogLevel('WARN this could be a debug message')).toBe(LogLevel.warn);
  });
});

import { LogLevel } from 'app/core/logs_model';

import { findCommonLabels, findUncommonLabels, formatLabels, getLogLevel, parseLabels } from './result_transformer';

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

describe('findUncommonLabels()', () => {
  it('returns no uncommon labels on empty sets', () => {
    expect(findUncommonLabels({}, {})).toEqual({});
  });

  it('returns all labels given no common labels', () => {
    expect(findUncommonLabels({ foo: '"bar"' }, {})).toEqual({ foo: '"bar"' });
  });

  it('returns all labels except the common labels', () => {
    expect(findUncommonLabels({ foo: '"bar"', baz: '"42"' }, { foo: '"bar"' })).toEqual({ baz: '"42"' });
  });
});
